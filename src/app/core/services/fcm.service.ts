import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FcmService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private messaging: Messaging | null = null;
    private currentToken: string | null = null;

    /** Call once on app init (browser only) */
    async init(): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;

        const supported = await isSupported().catch(() => false);
        if (!supported) return;

        const app: FirebaseApp =
            getApps().length > 0 ? getApps()[0]! : initializeApp(environment.firebase);

        this.messaging = getMessaging(app);

        // Listen for foreground messages
        onMessage(this.messaging, (payload) => {
            const { title, body } = payload.notification ?? {};
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title ?? 'mhfrough.dev', {
                    body: body ?? '',
                    icon: '/icons/icon-192x192.png',
                });
            }
        });
    }

    /** Request permission and register the FCM token with the backend */
    async requestPermissionAndRegister(): Promise<boolean> {
        if (!isPlatformBrowser(this.platformId) || !this.messaging) return false;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;

            const token = await getToken(this.messaging, {
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
