import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

const CONTACT_USER_KEY = 'mhf_contact_user';

const SESSION_KEY = 'vst_sid';

@Injectable({ providedIn: 'root' })
export class VisitorTrackingService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly api = `${environment.apiUrl}/visitors`;

    private sessionId: string | null = null;
    private currentPath: string | null = null;
    private pageStartMs: number | null = null;

    init() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.sessionId = sessionStorage.getItem(SESSION_KEY);
    }

    ping(path: string) {
        if (!isPlatformBrowser(this.platformId)) return;

        const cleanPath = path.split('?')[0].split('#')[0] || '/';

        if (this.currentPath && this.sessionId) {
            this.emitLeave(this.currentPath);
        }

        this.currentPath = cleanPath;
        this.pageStartMs = Date.now();

        const body: Record<string, unknown> = { path: cleanPath };
        if (this.sessionId) body['sessionId'] = this.sessionId;
        body['screenRes'] = `${screen.width}x${screen.height}`;
        body['language'] = (navigator.language ?? '').slice(0, 10) || undefined;
        const ref = document.referrer?.slice(0, 500);
        if (ref) body['referrer'] = ref;
        try {
            const cu = localStorage.getItem(CONTACT_USER_KEY);
            if (cu) body['contactUser'] = JSON.parse(cu);
        } catch { /* ignore */ }

        this.http.post<{ sessionId: string }>(`${this.api}/ping`, body).subscribe({
            next: (res) => {
                this.sessionId = res.sessionId;
                sessionStorage.setItem(SESSION_KEY, res.sessionId);
            },
            error: () => { },
        });
    }

    /** Track a named user action — call from components on meaningful interactions */
    trackEvent(eventName: string, metadata?: Record<string, string>) {
        if (!isPlatformBrowser(this.platformId) || !this.sessionId) return;
        const body: Record<string, unknown> = {
            sessionId: this.sessionId,
            eventName,
            path: this.currentPath ?? undefined,
        };
        if (metadata) body['metadata'] = metadata;
        this.http.post(`${this.api}/event`, body).subscribe({ error: () => { } });
    }

    sendLeave(path?: string) {
        if (!isPlatformBrowser(this.platformId) || !this.sessionId) return;
        this.emitLeave(path ?? this.currentPath ?? '');
        this.currentPath = null;
        this.pageStartMs = null;
    }

    private emitLeave(path: string) {
        if (!this.sessionId) return;
        const timeOnPageMs = this.pageStartMs ? Date.now() - this.pageStartMs : undefined;
        const payload = JSON.stringify({ sessionId: this.sessionId, path, timeOnPageMs });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${this.api}/leave`, new Blob([payload], { type: 'application/json' }));
        }
    }
}
