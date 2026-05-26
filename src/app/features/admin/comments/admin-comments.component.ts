import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlogsService } from '../../../core/services/blogs.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-admin-comments',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-comments.component.html',
})
export class AdminCommentsComponent implements OnInit, OnDestroy {
    private service = inject(BlogsService);
    readonly notif = inject(AdminNotificationService);
    private readonly realtime = inject(RealtimeService);

    readonly comments = signal<any[]>([]);
    readonly loading = signal(true);
    readonly filter = signal<'pending' | 'all'>('pending');
    readonly deleteTargetId = signal<string | null>(null);
    readonly statusModal = signal<{ id: string; title: string; reason: string } | null>(null);

    private subs = new Subscription();

    ngOnInit() {
        this.load();

        // comment:new → prepend to list (admin submitted a new pending comment)
        this.subs.add(this.realtime.on<any>('comment:new').subscribe(comment => {
            if (this.filter() === 'pending') {
                this.comments.update(list => [comment, ...list]);
            } else {
                this.comments.update(list => [comment, ...list]);
            }
            this.notif.fetchCounts();
        }));

        // comment:approved → remove from pending, update in all-view
        this.subs.add(this.realtime.on<any>('comment:approved').subscribe(comment => {
            if (this.filter() === 'pending') {
                this.comments.update(list => list.filter(c => c.id !== comment.id));
            } else {
                this.comments.update(list => list.map(c => c.id === comment.id ? comment : c));
            }
            this.notif.fetchCounts();
        }));

        // comment:unapproved → reload (moves to pending, need full data)
        this.subs.add(this.realtime.on<{ id: string; blogId: string }>('comment:unapproved').subscribe(() => {
            this.load();
            this.notif.fetchCounts();
        }));

        // comment:deleted → remove from list immediately
        this.subs.add(this.realtime.on<{ id: string }>('comment:deleted').subscribe(({ id }) => {
            this.comments.update(list => list.filter(c => c.id !== id));
            this.notif.fetchCounts();
        }));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    setFilter(f: 'pending' | 'all') {
        this.filter.set(f);
        this.load();
    }

    private load() {
        this.loading.set(true);
        const req = this.filter() === 'pending'
            ? this.service.getPendingComments()
            : this.service.getAllComments();
        req.subscribe({
            next: (data: any[]) => { this.comments.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    approve(id: string) {
        this.service.approveComment(id).subscribe(() => {
            this.notif.fetchCounts();
            // Optimistic update already handled via socket event; reload for safety
            this.load();
        });
    }

    confirmDelete(id: string) { this.deleteTargetId.set(id); }
    cancelDelete() { this.deleteTargetId.set(null); }
    executeDelete() {
        const id = this.deleteTargetId();
        if (!id) return;
        this.deleteTargetId.set(null);
        this.service.deleteComment(id).subscribe(() => {
            this.notif.fetchCounts();
        });
    }

    openStatusModal(id: string) { this.statusModal.set({ id, title: 'Unapprove Comment', reason: '' }); }
    cancelStatus() { this.statusModal.set(null); }
    setStatusReason(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        this.statusModal.update(m => m ? { ...m, reason: val } : null);
    }
    executeStatus() {
        const m = this.statusModal();
        if (!m) return;
        this.statusModal.set(null);
        this.service.unapproveComment(m.id, m.reason || undefined).subscribe(() => {
            this.notif.fetchCounts();
        });
    }

    remove(id: string) {
        this.service.deleteComment(id).subscribe(() => {
            this.notif.fetchCounts();
        });
    }
}
