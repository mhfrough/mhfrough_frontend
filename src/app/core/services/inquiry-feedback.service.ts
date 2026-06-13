import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NetworkStatusService } from './network-status.service';
import { SyncQueueService } from './sync-queue.service';

@Injectable({ providedIn: 'root' })
export class InquiriesService {
    private readonly http = inject(HttpClient);
    private readonly network = inject(NetworkStatusService);
    private readonly syncQueue = inject(SyncQueueService);
    private readonly base = `${environment.apiUrl}/inquiries`;

    submit(data: any): Observable<any> {
        if (!this.network.isOnline()) {
            return from(
                this.syncQueue.enqueue({ url: this.base, method: 'POST', body: data, timestamp: Date.now() })
                    .then(() => ({ queued: true }))
            );
        }
        return this.http.post<any>(this.base, data);
    }

    getAll() { return this.http.get<any[]>(this.base); }

    markRead(id: string): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}/read`, method: 'PATCH', body: {}, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.patch(`${this.base}/${id}/read`, {});
    }

    remove(id: string): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}`, method: 'DELETE', body: null, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.delete(`${this.base}/${id}`);
    }

    reply(id: string, dto: { subject: string; html: string }): Observable<any> {
        return this.http.post(`${this.base}/${id}/reply`, dto);
    }
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
    private readonly http = inject(HttpClient);
    private readonly network = inject(NetworkStatusService);
    private readonly syncQueue = inject(SyncQueueService);
    private readonly base = `${environment.apiUrl}/feedback`;

    getApproved() { return this.http.get<any[]>(this.base); }
    getApprovedPaginated(page: number, limit: number, q?: string) {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        return this.http.get<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(this.base, { params });
    }
    getFeatured() { return this.http.get<any[]>(`${this.base}/featured`); }
    getAll() { return this.http.get<any[]>(`${this.base}/all`); }

    setFeatured(id: string, featured: boolean): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}/feature`, method: 'PATCH', body: { featured }, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.patch(`${this.base}/${id}/feature`, { featured });
    }

    submit(data: any): Observable<any> {
        if (!this.network.isOnline()) {
            return from(
                this.syncQueue.enqueue({ url: this.base, method: 'POST', body: data, timestamp: Date.now() })
                    .then(() => ({ queued: true }))
            );
        }
        return this.http.post<any>(this.base, data);
    }

    approve(id: string): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}/approve`, method: 'PATCH', body: {}, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.patch(`${this.base}/${id}/approve`, {});
    }

    unapprove(id: string, adminNote?: string): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}/unapprove`, method: 'PATCH', body: { adminNote }, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.patch(`${this.base}/${id}/unapprove`, { adminNote });
    }

    remove(id: string): Observable<any> {
        if (!this.network.isOnline()) {
            return from(this.syncQueue.enqueue({ url: `${this.base}/${id}`, method: 'DELETE', body: null, timestamp: Date.now() }).then(() => ({ queued: true })));
        }
        return this.http.delete(`${this.base}/${id}`);
    }
}
