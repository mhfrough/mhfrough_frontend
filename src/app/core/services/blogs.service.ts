import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IdbService } from './idb.service';
import { NetworkStatusService } from './network-status.service';
import { SyncQueueService } from './sync-queue.service';

@Injectable({ providedIn: 'root' })
export class BlogsService {
    private readonly http = inject(HttpClient);
    private readonly idb = inject(IdbService);
    private readonly network = inject(NetworkStatusService);
    private readonly syncQueue = inject(SyncQueueService);
    private readonly base = `${environment.apiUrl}/blogs`;
    private readonly commentsBase = `${environment.apiUrl}/blog-comments`;

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=blog`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }

    getPublic(page: number, limit: number, q?: string, tag?: string): Observable<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        if (tag && tag !== 'all') params['tag'] = tag;
        return new Observable(subscriber => {
            // Serve stale IDB data immediately on page 1 with no filters
            if (page === 1 && !q && !tag) {
                this.idb.getAll<any>('blogs').then(cached => {
                    if (cached.length) {
                        subscriber.next({ data: cached.slice(0, limit), total: cached.length, page: 1, limit, totalPages: Math.ceil(cached.length / limit) });
                    }
                });
            }
            this.http.get<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(this.base, { params }).subscribe({
                next: fresh => {
                    if (page === 1 && !q && !tag) {
                        this.idb.putMany('blogs', fresh.data).catch(() => {});
                    }
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    getAllAdmin() { return this.http.get<any[]>(`${this.base}/all`); }
    getOne(id: string) { return this.http.get<any>(`${this.base}/admin/${id}`); }
    getTags() { return this.http.get<string[]>(`${this.base}/tags`); }

    getBySlug(slug: string): Observable<any> {
        return new Observable(subscriber => {
            this.idb.getAllByIndex<any>('blogs', 'slug', slug).then(cached => {
                if (cached.length) subscriber.next(cached[0]);
            });
            this.http.get<any>(`${this.base}/${slug}`).subscribe({
                next: fresh => {
                    this.idb.put('blogs', fresh).catch(() => {});
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    create(data: any) { return this.http.post<any>(this.base, data); }
    update(id: string, data: any) { return this.http.put<any>(`${this.base}/${id}`, data); }
    unpublish(id: string, adminNote?: string) { return this.http.patch<any>(`${this.base}/${id}/unpublish`, { adminNote }); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }

    // Comments
    getComments(blogId: string) { return this.http.get<any[]>(`${this.commentsBase}/post/${blogId}`); }
    getCommentCount(blogId: string) { return this.http.get<{ count: number }>(`${this.commentsBase}/post/${blogId}/count`); }

    submitComment(blogId: string, data: { authorName: string; authorEmail: string; content: string }): Observable<any> {
        if (!this.network.isOnline()) {
            return from(
                this.syncQueue.enqueue({
                    url: `${this.commentsBase}/post/${blogId}`,
                    method: 'POST',
                    body: data,
                    timestamp: Date.now(),
                }).then(() => ({ queued: true }))
            );
        }
        return this.http.post<any>(`${this.commentsBase}/post/${blogId}`, data);
    }

    // Admin comments
    getPendingComments() { return this.http.get<any[]>(`${this.commentsBase}/pending`); }
    getAllComments() { return this.http.get<any[]>(`${this.commentsBase}`); }
    approveComment(id: string) { return this.http.patch(`${this.commentsBase}/${id}/approve`, {}); }
    unapproveComment(id: string, adminNote?: string) { return this.http.patch(`${this.commentsBase}/${id}/unapprove`, { adminNote }); }
    deleteComment(id: string) { return this.http.delete(`${this.commentsBase}/${id}`); }
}
