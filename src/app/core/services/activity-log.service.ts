import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ActivityLogEntry {
    id: string;
    action: string;
    resource: string;
    resourceId?: string;
    resourceTitle?: string;
    description: string;
    status: 'success' | 'error';
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin/activity-logs`;

    getLogs(limit = 300) {
        const params = new HttpParams().set('limit', limit);
        return this.http.get<ActivityLogEntry[]>(this.base, { params });
    }

    remove(id: string) {
        return this.http.delete(`${this.base}/${id}`);
    }

    clearAll() {
        return this.http.delete(`${this.base}/all`);
    }

    reportClientError(message: string, stack?: string, context?: string, statusCode?: number) {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        return this.http.post(`${this.base}/client-error`, { message, stack, url, context, statusCode }, { responseType: 'text' });
    }

    reportPageNotFound(url: string) {
        return this.http.post(`${this.base}/page-not-found`, { url }, { responseType: 'text' });
    }
}
