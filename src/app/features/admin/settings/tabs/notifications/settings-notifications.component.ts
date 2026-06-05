import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { PushNotificationAdminService } from '../../../../../core/services/push-notification-admin.service';
import { FcmService } from '../../../../../core/services/fcm.service';

@Component({
    selector: 'app-settings-notifications',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings-notifications.component.html',
})
export class SettingsNotificationsComponent {
    readonly fcm = inject(FcmService);
    private readonly pushService = inject(PushNotificationAdminService);

    pushTitle = '';
    pushBody = '';
    pushUrl = '';
    readonly pushing = signal(false);
    readonly pushSuccess = signal<string | null>(null);
    readonly pushError = signal<string | null>(null);

    requestPushPermission() {
        this.fcm.requestPermissionAndRegister().then((granted) => {
            if (!granted) this.pushError.set('Permission denied or token registration failed.');
            else {
                this.pushSuccess.set('Push notifications enabled for this browser!');
                setTimeout(() => this.pushSuccess.set(null), 4000);
            }
        });
    }

    sendPush(f: NgForm) {
        f.form.markAllAsTouched();
        if (f.invalid) return;
        this.pushing.set(true);
        this.pushSuccess.set(null);
        this.pushError.set(null);
        this.pushService.send({ title: this.pushTitle, body: this.pushBody, url: this.pushUrl || undefined }).subscribe({
            next: () => {
                this.pushing.set(false);
                this.pushSuccess.set('Push notification sent to all subscribers.');
                this.pushTitle = '';
                this.pushBody = '';
                this.pushUrl = '';
            },
            error: (err: any) => {
                this.pushing.set(false);
                this.pushError.set(err?.error?.message ?? 'Failed to send notification.');
            },
        });
    }
}
