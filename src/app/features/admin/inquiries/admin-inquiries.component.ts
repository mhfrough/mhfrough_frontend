import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
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
