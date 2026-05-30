import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

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

        // Send leave event for previous page before tracking new one
        if (this.currentPath && this.sessionId) {
            this.emitLeave(this.currentPath);
        }

        this.currentPath = path;
        this.pageStartMs = Date.now();

        const body: Record<string, unknown> = { path };
        if (this.sessionId) body['sessionId'] = this.sessionId;
        body['screenRes'] = `${screen.width}x${screen.height}`;
        body['language'] = (navigator.language ?? '').slice(0, 10) || undefined;
        const ref = document.referrer?.slice(0, 500);
        if (ref) body['referrer'] = ref;

        this.http.post<{ sessionId: string }>(`${this.api}/ping`, body).subscribe({
            next: (res) => {
                this.sessionId = res.sessionId;
                sessionStorage.setItem(SESSION_KEY, res.sessionId);
            },
            error: () => { /* silent — never block UX */ },
        });
    }

    /** Call on navigation away or page unload via sendBeacon */
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
