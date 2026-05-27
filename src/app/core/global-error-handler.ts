import { ErrorHandler, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivityLogService } from './services/activity-log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    private readonly platformId = inject(PLATFORM_ID);
    // Lazy-inject to avoid circular DI issues at bootstrap
    private activityLog: ActivityLogService | null = null;

    private getService(): ActivityLogService | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        if (!this.activityLog) {
            try {
                this.activityLog = inject(ActivityLogService);
            } catch {
                return null;
            }
        }
        return this.activityLog;
    }

    handleError(error: unknown): void {
        const err = error instanceof Error ? error : new Error(String(error));
        // Always log to console first
        console.error('[GlobalErrorHandler]', err);

        // Skip chunk-load errors (lazy module loading fails, not real bugs)
        if (err.message?.includes('ChunkLoadError') || err.message?.includes('Loading chunk')) return;

        const svc = this.getService();
        if (svc) {
            svc.reportClientError(
                err.message?.slice(0, 500) ?? 'Unknown error',
                err.stack?.slice(0, 5000),
            ).subscribe({ error: () => { /* silently ignore reporting failures */ } });
        }
    }
}
