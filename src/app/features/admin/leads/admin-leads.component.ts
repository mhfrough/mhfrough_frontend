import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LeadsService, Lead, LeadStatus } from '../../../core/services/leads.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

const STATUS_LABELS: Record<LeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    quoted: 'Quoted',
    won: 'Won',
    lost: 'Lost',
};

const STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
    new: '',
    contacted: '',
    qualified: 'admin-badge--warn',
    quoted: 'admin-badge--warn',
    won: 'admin-badge--on',
    lost: 'admin-badge--danger',
};

const SOURCE_LABELS: Record<string, string> = {
    email: 'Email',
    chat: 'Live Chat',
    appointment: 'Appointment',
    manual: 'Manual',
};

@Component({
    selector: 'app-admin-leads',
    standalone: true,
    imports: [CommonModule, RouterLink, PaginationComponent, ConfirmModalComponent],
    templateUrl: './admin-leads.component.html',
})
export class AdminLeadsComponent extends AdminListBase implements OnInit, OnDestroy {
    private readonly svc = inject(LeadsService);
    private readonly realtime = inject(RealtimeService);
    private readonly subs = new Subscription();

    readonly leads = signal<Lead[]>([]);
    readonly loading = signal(true);
    readonly filterStatus = signal<'all' | LeadStatus>('all');

    readonly statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'];

    readonly filteredLeads = computed(() => {
        const status = this.filterStatus();
        const q = this.searchQuery().toLowerCase().trim();
        return this.leads().filter(lead => {
            if (status !== 'all' && lead.status !== status) return false;
            if (!q) return true;
            return (
                lead.name?.toLowerCase().includes(q) ||
                lead.email?.toLowerCase().includes(q) ||
                lead.phone?.toLowerCase().includes(q)
            );
        });
    });

    readonly pagedLeads = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredLeads().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredLeads().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // Live pipeline: leads arrive from chat, email, and appointments while viewing
        this.subs.add(this.realtime.on<Lead>('lead:created').subscribe(lead => {
            this.leads.update(list => list.some(l => l.id === lead.id) ? list : [lead, ...list]);
        }));
        this.subs.add(this.realtime.on<Lead>('lead:updated').subscribe(lead => {
            this.leads.update(list => list.map(l => l.id === lead.id ? { ...l, ...lead } : l));
        }));
        this.subs.add(this.realtime.on<{ id: string }>('lead:deleted').subscribe(({ id }) => {
            this.leads.update(list => list.filter(l => l.id !== id));
        }));
    }

    ngOnDestroy() {
        this.subs.unsubscribe();
    }

    load() {
        this.loading.set(true);
        this.svc.getAll().subscribe({
            next: (data) => {
                this.leads.set(data);
                this.loading.set(false);
            },
            error: () => this.loading.set(false),
        });
    }

    setFilter(status: 'all' | LeadStatus): void {
        this.filterStatus.set(status);
        this.currentPage.set(1);
    }

    onStatusChange(lead: Lead, event: Event): void {
        const status = (event.target as HTMLSelectElement).value as LeadStatus;
        if (status === lead.status) return;
        this.svc.update(lead.id, { status }).subscribe((updated) => {
            this.leads.update(list => list.map(l => l.id === lead.id ? { ...l, status: updated.status } : l));
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.svc.remove(id).subscribe(() => this.load());
    }

    statusLabel(status: LeadStatus): string {
        return STATUS_LABELS[status] ?? status;
    }

    statusBadgeClass(status: LeadStatus): string {
        return STATUS_BADGE_CLASS[status] ?? '';
    }

    sourceLabel(source: string): string {
        return SOURCE_LABELS[source] ?? source;
    }

    formatDate(d: string): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
}
