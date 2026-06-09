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
    markRead(id: string) { return this.http.patch(`${this.base}/${id}/read`, {}); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
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
    getAll() { return this.http.get<any[]>(`${this.base}/all`); }

    submit(data: any): Observable<any> {
        if (!this.network.isOnline()) {
            return from(
                this.syncQueue.enqueue({ url: this.base, method: 'POST', body: data, timestamp: Date.now() })
                    .then(() => ({ queued: true }))
            );
        }
        return this.http.post<any>(this.base, data);
    }

    approve(id: string) { return this.http.patch(`${this.base}/${id}/approve`, {}); }
    unapprove(id: string, adminNote?: string) { return this.http.patch(`${this.base}/${id}/unapprove`, { adminNote }); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}
