import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { AdminListBase } from '../../../shared/admin-list.base';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
    selector: 'app-admin-inquiries',
    standalone: true,
    imports: [CommonModule, PaginationComponent, ConfirmModalComponent],
    templateUrl: './admin-inquiries.component.html',
})
export class AdminInquiriesComponent extends AdminListBase implements OnInit, OnDestroy {
    private readonly service = inject(InquiriesService);
    private readonly notif = inject(AdminNotificationService);
    private readonly realtime = inject(RealtimeService);
    readonly inquiries = signal<any[]>([]);
    readonly loading = signal(true);
    private subs = new Subscription();

    readonly filteredInquiries = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.inquiries();
        return this.inquiries().filter(inq =>
            inq.name?.toLowerCase().includes(q) ||
            inq.email?.toLowerCase().includes(q) ||
            inq.subject?.toLowerCase().includes(q) ||
            inq.message?.toLowerCase().includes(q)
        );
    });

    readonly pagedInquiries = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.filteredInquiries().slice(start, start + this.pageSize());
    });

    override readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredInquiries().length / this.pageSize()))
    );

    ngOnInit() {
        this.load();

        // inquiry:new → prepend to list immediately
        this.subs.add(this.realtime.on<any>('inquiry:new').subscribe(inquiry => {
            this.inquiries.update(list => [inquiry, ...list]);
            this.notif.fetchCounts();
        }));

        // inquiry:read → update status in-place
        this.subs.add(this.realtime.on<{ id: string; status: string }>('inquiry:read').subscribe(({ id, status }) => {
            this.inquiries.update(list => list.map(i => i.id === id ? { ...i, status } : i));
            this.notif.fetchCounts();
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAll().subscribe({ next: (d: any[]) => { this.inquiries.set(d); this.loading.set(false); } });
    }

    markRead(id: string) {
        this.service.markRead(id).subscribe(() => {
            this.notif.fetchCounts();
        });
    }

    override executeDelete(): void {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => {
            this.inquiries.update(list => list.filter(i => i.id !== id));
            this.notif.fetchCounts();
        });
    }
}
