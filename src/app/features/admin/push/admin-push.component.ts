import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PushNotificationAdminService } from '../../../core/services/push-notification-admin.service';
import { FcmService } from '../../../core/services/fcm.service';

@Component({
    selector: 'app-admin-push',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './admin-push.component.html',
})
export class AdminPushComponent {
    private readonly pushService = inject(PushNotificationAdminService);
    readonly fcm = inject(FcmService);

    title = '';
    body = '';
    url = '';

    readonly sending = signal(false);
    readonly success = signal<string | null>(null);
    readonly error = signal<string | null>(null);

    requestPermission() {
        this.fcm.requestPermissionAndRegister().then((granted) => {
            if (!granted) {
                this.error.set('Permission denied or token registration failed.');
            } else {
                this.success.set('Push notifications enabled for this browser!');
                setTimeout(() => this.success.set(null), 4000);
            }
        });
    }

    send() {
        if (!this.title.trim() || !this.body.trim()) return;
        this.sending.set(true);
        this.success.set(null);
        this.error.set(null);

        this.pushService.send({ title: this.title, body: this.body, url: this.url || undefined }).subscribe({
            next: () => {
                this.sending.set(false);
                this.success.set('Push notification sent to all subscribers.');
                this.title = '';
                this.body = '';
                this.url = '';
            },
            error: (err) => {
                this.sending.set(false);
                this.error.set(err?.error?.message ?? 'Failed to send notification.');
            },
        });
    }
}
