import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { InquiriesService } from '../../../core/services/inquiry-feedback.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';

@Component({
    selector: 'app-admin-inquiries',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-inquiries.component.html',
})
export class AdminInquiriesComponent implements OnInit, OnDestroy {
    private readonly service = inject(InquiriesService);
    private readonly notif = inject(AdminNotificationService);
    readonly inquiries = signal<any[]>([]);
    readonly loading = signal(true);
    private subs = new Subscription();

    ngOnInit() {
        this.load();
        this.subs.add(this.notif.inquiriesChanged$.subscribe(() => this.load()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    load() {
        this.service.getAll().subscribe({ next: (d: any[]) => { this.inquiries.set(d); this.loading.set(false); } });
    }

    markRead(id: string) {
        this.service.markRead(id).subscribe(() => {
            this.load();
            this.notif.fetchCounts();
        });
    }
}
