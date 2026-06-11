import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IdbService } from './idb.service';
import { NetworkStatusService } from './network-status.service';
import { SyncQueueService } from './sync-queue.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
    private readonly http = inject(HttpClient);
    private readonly idb = inject(IdbService);
    private readonly network = inject(NetworkStatusService);
    private readonly syncQueue = inject(SyncQueueService);
    private readonly base = `${environment.apiUrl}/projects`;

    private enqueue(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body: unknown = null): Observable<any> {
        return from(this.syncQueue.enqueue({ url, method, body, timestamp: Date.now() }).then(() => ({ queued: true })));
    }

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=project`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }

    getPublic(page: number, limit: number, q?: string, tag?: string): Observable<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        if (tag && tag !== 'all') params['tag'] = tag;
        return new Observable(subscriber => {
            if (page === 1 && !q && !tag) {
                this.idb.getAll<any>('projects').then(cached => {
                    if (cached.length) {
                        subscriber.next({ data: cached.slice(0, limit), total: cached.length, page: 1, limit, totalPages: Math.ceil(cached.length / limit) });
                    }
                });
            }
            this.http.get<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(this.base, { params }).subscribe({
                next: fresh => {
                    if (page === 1 && !q && !tag) {
                        this.idb.putMany('projects', fresh.data).catch(() => {});
                    }
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    getFeatured(): Observable<any[]> {
        return new Observable(subscriber => {
            this.idb.getAll<any>('projects').then(cached => {
                const featured = cached.filter(p => p.isFeatured);
                if (featured.length) subscriber.next(featured);
            });
            this.http.get<any[]>(`${this.base}/featured`).subscribe({
                next: fresh => {
                    this.idb.putMany('projects', fresh).catch(() => {});
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    getTags() { return this.http.get<string[]>(`${this.base}/tags`); }
    getAllAdmin() { return this.http.get<any[]>(`${this.base}/all`); }
    getOne(id: string) { return this.http.get<any>(`${this.base}/${id}`); }
    getBySlug(slug: string) { return this.http.get<any>(`${this.base}/slug/${slug}`); }

    create(data: any): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('POST', this.base, data);
        return this.http.post<any>(this.base, data);
    }

    update(id: string, data: any): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('PUT', `${this.base}/${id}`, data);
        return this.http.put<any>(`${this.base}/${id}`, data);
    }

    patchFeatured(id: string, featured: boolean): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('PATCH', `${this.base}/${id}/featured`, { featured });
        return this.http.patch<any>(`${this.base}/${id}/featured`, { featured });
    }

    unpublish(id: string, adminNote?: string): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('PATCH', `${this.base}/${id}/unpublish`, { adminNote });
        return this.http.patch<any>(`${this.base}/${id}/unpublish`, { adminNote });
    }

    remove(id: string): Observable<any> {
        if (!this.network.isOnline()) return this.enqueue('DELETE', `${this.base}/${id}`);
        return this.http.delete(`${this.base}/${id}`);
    }
}
