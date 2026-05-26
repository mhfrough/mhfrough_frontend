import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PushNotificationAdminService, PushNotificationLog } from '../../../core/services/push-notification-admin.service';

@Component({
    selector: 'app-admin-notification-logs',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './admin-notification-logs.component.html',
})
export class AdminNotificationLogsComponent implements OnInit {
    private readonly service = inject(PushNotificationAdminService);
    readonly logs = signal<PushNotificationLog[]>([]);
    readonly loading = signal(true);

    readonly sourceLabels: Record<string, string> = {
        inquiry: 'Contact Form',
        feedback: 'Review',
        comment: 'Blog Comment',
        chat: 'Chat Widget',
        admin: 'Admin Broadcast',
    };

    readonly sourceIcons: Record<string, string> = {
        inquiry: 'bi-envelope',
        feedback: 'bi-star',
        comment: 'bi-chat-left-text',
        chat: 'bi-chat-dots',
        admin: 'bi-megaphone',
    };

    ngOnInit() {
        this.service.getLogs(200).subscribe({
            next: (data) => { this.logs.set(data); this.loading.set(false); },
            error: () => this.loading.set(false),
        });
    }

    refresh() {
        this.loading.set(true);
        this.ngOnInit();
    }
}
