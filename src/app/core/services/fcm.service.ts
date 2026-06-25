import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import type { Messaging } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FcmService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private messaging: Messaging | null = null;
    private currentToken: string | null = null;

    /**
     * Lazily import the Firebase SDK and initialise Messaging on first use.
     * Firebase (~150 KB) is code-split into its own chunk so it never lands in
     * the initial bundle — it is only fetched when notifications are actually
     * used (granted before, or the user opts in).
     */
    private async ensureMessaging(): Promise<Messaging | null> {
        if (!isPlatformBrowser(this.platformId)) return null;
        if (this.messaging) return this.messaging;

        const [{ initializeApp, getApps }, { getMessaging, onMessage, isSupported }] =
            await Promise.all([import('firebase/app'), import('firebase/messaging')]);

        if (!(await isSupported().catch(() => false))) return null;

        const app = getApps().length > 0 ? getApps()[0]! : initializeApp(environment.firebase);
        this.messaging = getMessaging(app);

        // Listen for foreground messages
        onMessage(this.messaging, (payload) => {
            const { title, body } = payload.notification ?? {};
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title ?? 'mhfrough.dev', {
                    body: body ?? '',
                    icon: '/icons/icon-192x192.png',
                    badge: '/badge-icon.svg',
                } as NotificationOptions);
            }
        });

        return this.messaging;
    }

    /**
     * Call once on app init (browser only). Only wires up Firebase for visitors
     * who have *already* granted notification permission — first-time visitors
     * pay no Firebase cost on load.
     */
    async init(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        await this.ensureMessaging();
    }

    /** Request permission and register the FCM token with the backend */
    async requestPermissionAndRegister(): Promise<boolean> {
        if (!isPlatformBrowser(this.platformId)) return false;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;

            const messaging = await this.ensureMessaging();
            if (!messaging) return false;

            const { getToken } = await import('firebase/messaging');
            const token = await getToken(messaging, {
                vapidKey: environment.firebase.vapidKey,
                serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(
                    '/firebase-messaging-sw.js',
                ),
            });

            if (!token) return false;

            this.currentToken = token;
            await this.http
                .post(`${environment.apiUrl}/fcm/register`, { token, platform: 'web' })
                .toPromise();

            return true;
        } catch {
            return false;
        }
    }

    async unregister(): Promise<void> {
        if (!this.currentToken) return;
        await this.http
            .delete(`${environment.apiUrl}/fcm/unregister`, { body: { token: this.currentToken } })
            .toPromise();
        this.currentToken = null;
    }

    get hasPermission(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        return 'Notification' in window && Notification.permission === 'granted';
    }

    get permissionState(): NotificationPermission | 'unsupported' {
        if (!isPlatformBrowser(this.platformId)) return 'unsupported';
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }
}
