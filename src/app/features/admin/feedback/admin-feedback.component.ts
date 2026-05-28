import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';

@Component({
    selector: 'app-admin-feedback',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-feedback.component.html',
})
export class AdminFeedbackComponent implements OnInit, OnDestroy {
    private readonly service = inject(FeedbackService);
    private readonly notif = inject(AdminNotificationService);
    private readonly realtime = inject(RealtimeService);
    readonly feedback = signal<any[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    private subs = new Subscription();

    // ── Pagination + Search ──────────────────────────────────────────────────
    readonly searchQuery = signal('');
    readonly pageSize = signal(25);
    readonly currentPage = signal(1);

    readonly filteredFeedback = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.feedback();
        return this.feedback().filter(fb =>
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

    readonly totalPages = computed(() =>
        Math.max(1, Math.ceil(this.filteredFeedback().length / this.pageSize()))
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

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe();
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unapprove Review', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unapprove(m.id, m.reason || undefined).subscribe(() => {
            this.notif.fetchCounts();
        });
    }
}
