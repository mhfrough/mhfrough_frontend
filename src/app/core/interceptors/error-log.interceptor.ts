import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, throwError } from 'rxjs';
import { ActivityLogService } from '../services/activity-log.service';

/** URL fragments that must never trigger an activity-log report (prevents infinite loops). */
const SKIP_PATTERNS = ['/activity-logs', '/auth/login', '/auth/logout'];

function shouldSkip(url: string): boolean {
    return SKIP_PATTERNS.some(p => url.includes(p));
}

function buildContext(req: HttpRequest<unknown>, status: number): string {
    try {
        const path = new URL(req.url).pathname;
        return `HTTP ${status} ${req.method} ${path}`.slice(0, 200);
    } catch {
        return `HTTP ${status} ${req.method}`.slice(0, 200);
    }
}

export const errorLogInterceptor: HttpInterceptorFn = (req, next) => {
    const platformId = inject(PLATFORM_ID);
    // Only run in the browser — SSR has no activity log session
    if (!isPlatformBrowser(platformId)) return next(req);
    if (shouldSkip(req.url)) return next(req);

    const activityLog = inject(ActivityLogService);

    return next(req).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse) {
                // 401 is already handled by authInterceptor; skip to avoid duplicate logs
                if (error.status !== 401) {
                    const message = (error.error?.message ?? error.message ?? 'HTTP error').toString().slice(0, 500);
                    const context = buildContext(req, error.status);

                    activityLog
                        .reportClientError(message, undefined, context, error.status)
                        .subscribe({ error: () => { /* silently ignore if reporting itself fails */ } });
                }
            }
            return throwError(() => error);
        }),
    );
};
