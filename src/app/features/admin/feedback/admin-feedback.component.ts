import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ReasonModalComponent } from '../../../shared/components/reason-modal/reason-modal.component';

@Component({
    selector: 'app-admin-feedback',
    standalone: true,
    imports: [CommonModule, PaginationComponent, ConfirmModalComponent, ReasonModalComponent],
    templateUrl: './admin-feedback.component.html',
})
export class AdminFeedbackComponent extends AdminListBase implements OnInit, OnDestroy {
    private readonly service = inject(FeedbackService);
    private readonly notif = inject(AdminNotificationService);
    private readonly realtime = inject(RealtimeService);
    readonly feedback = signal<any[]>([]);
    readonly loading = signal(true);
    readonly statusModal = signal<{ id: string; title: string } | null>(null);
    private subs = new Subscription();

    readonly filteredFeedback = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        const sorted = this.feedback();
        if (!q) return sorted;
        return sorted.filter(fb =>
            fb.name?.toLowerCase().includes(q) ||
            fb.role?.toLowerCase().includes(q) ||
            fb.company?.toLowerCase().includes(q) ||
            fb.review?.toLowerCase().includes(q)
        );
    });

    readonly pagedFeedback = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredFeedback().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredFeedback().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // feedback:new → prepend to list
        this.subs.add(this.realtime.on<any>('feedback:new').subscribe(item => {
            this.feedback.update(list => [item, ...list]);
            this.notif.fetchCounts();
        }));

        // feedback:approved → update item in-place
        this.subs.add(this.realtime.on<any>('feedback:approved').subscribe(item => {
            this.feedback.update(list => list.map(f => f.id === item.id ? item : f));
            this.notif.fetchCounts();
        }));

        // feedback:unapproved → update item in-place (mark as unapproved)
        this.subs.add(this.realtime.on<{ id: string }>('feedback:unapproved').subscribe(({ id }) => {
            this.feedback.update(list => list.map(f => f.id === id ? { ...f, isApproved: false } : f));
            this.notif.fetchCounts();
        }));

        // feedback:deleted → remove from list
        this.subs.add(this.realtime.on<{ id: string }>('feedback:deleted').subscribe(({ id }) => {
            this.feedback.update(list => list.filter(f => f.id !== id));
            this.notif.fetchCounts();
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAll().subscribe({ next: (d: any[]) => { this.feedback.set(d); this.loading.set(false); } });
    }

    approve(id: string) {
        this.service.approve(id).subscribe(() => {
            this.notif.fetchCounts();
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openStatusModal(id: string): void { this.statusModal.set({ id, title: 'Unapprove Review' }); }
    cancelStatus(): void { this.statusModal.set(null); }
    executeStatus(reason: string): void {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unapprove(m.id, reason || undefined).subscribe(() => {
            this.notif.fetchCounts();
        });
    }
}
