import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { FeedbackService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';

@Component({
    selector: 'app-admin-feedback',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-feedback.component.html',
})
export class AdminFeedbackComponent implements OnInit, OnDestroy {
    private readonly service = inject(FeedbackService);
    private readonly notif = inject(AdminNotificationService);
    readonly feedback = signal<any[]>([]);
    readonly loading = signal(true);
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);
    private subs = new Subscription();

    ngOnInit() {
        this.load();
        this.subs.add(this.notif.feedbackChanged$.subscribe(() => this.load()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAll().subscribe({ next: (d: any[]) => { this.feedback.set(d); this.loading.set(false); } });
    }

    approve(id: string) {
        this.service.approve(id).subscribe(() => {
            this.load();
            this.notif.fetchCounts();
        });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }

    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.remove(id).subscribe(() => this.load());
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
            this.load();
            this.notif.fetchCounts();
        });
    }
}
