import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FcmService } from '../../core/services/fcm.service';

const STORAGE_KEY = 'push_notification_prompt';

@Component({
    selector: 'app-push-notification-prompt',
    standalone: true,
    templateUrl: './push-notification-prompt.component.html',
    styleUrl: './push-notification-prompt.component.scss',
})
export class PushNotificationPromptComponent implements OnInit, OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly fcm = inject(FcmService);

    readonly visible = signal(false);
    readonly loading = signal(false);

    private timer: ReturnType<typeof setTimeout> | null = null;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;
        if (localStorage.getItem(STORAGE_KEY)) return;

        this.timer = setTimeout(() => this.tryNativeOrShowPrompt(), 4000);
    }

    private async tryNativeOrShowPrompt(): Promise<void> {
        try {
            // If the browser can show its own native dialog (no user gesture needed),
            // let it handle everything — don't show the custom banner.
            const permission = await Notification.requestPermission();
            localStorage.setItem(STORAGE_KEY, 'prompted');
            if (permission === 'granted') {
                await this.fcm.requestPermissionAndRegister();
            }
        } catch {
            // Browser requires a user gesture — fall back to the custom in-page banner.
            this.visible.set(true);
        }
    }

    ngOnDestroy() {
        if (this.timer !== null) clearTimeout(this.timer);
    }

    async enable() {
        this.loading.set(true);
        await this.fcm.requestPermissionAndRegister();
        this.loading.set(false);
        localStorage.setItem(STORAGE_KEY, 'prompted');
        this.visible.set(false);
    }

    dismiss() {
        localStorage.setItem(STORAGE_KEY, 'dismissed');
        this.visible.set(false);
    }
}
