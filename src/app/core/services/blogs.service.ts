import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OfflineResourceService, Paginated } from './offline-resource.service';

@Injectable({ providedIn: 'root' })
export class BlogsService extends OfflineResourceService {
    private readonly base = `${environment.apiUrl}/blogs`;
    private readonly commentsBase = `${environment.apiUrl}/blog-comments`;

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=blog`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }

    getPublic(page: number, limit: number, q?: string, tag?: string): Observable<Paginated<any>> {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        if (tag && tag !== 'all') params['tag'] = tag;
        return this.staleList<any>({
            store: 'blogs',
            cacheable: page === 1 && !q && !tag,
            limit,
            fetch: () => this.http.get<Paginated<any>>(this.base, { params }),
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

    create(data: any) { return this.mutate('POST', this.base, data); }
    update(id: string, data: any) { return this.mutate('PUT', `${this.base}/${id}`, data); }
    unpublish(id: string, adminNote?: string) { return this.mutate('PATCH', `${this.base}/${id}/unpublish`, { adminNote }); }
    remove(id: string) { return this.mutate('DELETE', `${this.base}/${id}`); }

    // Comments
    getComments(blogId: string) { return this.http.get<any[]>(`${this.commentsBase}/post/${blogId}`); }
    getCommentCount(blogId: string) { return this.http.get<{ count: number }>(`${this.commentsBase}/post/${blogId}/count`); }

    submitComment(blogId: string, data: { authorName: string; authorEmail: string; content: string }) {
        return this.mutate('POST', `${this.commentsBase}/post/${blogId}`, data);
    }

    // Admin comments
    getPendingComments() { return this.http.get<any[]>(`${this.commentsBase}/pending`); }
    getAllComments() { return this.http.get<any[]>(`${this.commentsBase}`); }

    approveComment(id: string) { return this.mutate('PATCH', `${this.commentsBase}/${id}/approve`, {}); }
    unapproveComment(id: string, adminNote?: string) { return this.mutate('PATCH', `${this.commentsBase}/${id}/unapprove`, { adminNote }); }
    deleteComment(id: string) { return this.mutate('DELETE', `${this.commentsBase}/${id}`); }
}
