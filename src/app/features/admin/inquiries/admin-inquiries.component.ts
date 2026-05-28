import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-admin-inquiries',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-inquiries.component.html',
})
export class AdminInquiriesComponent implements OnInit, OnDestroy {
    private readonly service = inject(InquiriesService);
    private readonly notif = inject(AdminNotificationService);
    private readonly realtime = inject(RealtimeService);
    readonly inquiries = signal<any[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    private subs = new Subscription();

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

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

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredInquiries().length / this.pageSize()))
    );

    get pageNumbers(): number[] {
        const total = this.totalPages();
        const cur = this.currentPage();
        const pages: number[] = [];
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) {
            pages.push(i);
        }
        return pages;
    }

    onSearch(e: Event) {
        this.searchQuery.set((e.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    onPageSizeChange(e: Event) {
        this.pageSize.set(+(e.target as HTMLSelectElement).value);
        this.currentPage.set(1);
    }

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

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => {
            this.inquiries.update(list => list.filter(i => i.id !== id));
            this.notif.fetchCounts();
        });
    }
}
