import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BlogsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/blogs`;
    private readonly commentsBase = `${environment.apiUrl}/blog-comments`;

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }
    getPublic(page: number, limit: number, q?: string) {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        return this.http.get<{ data: any[]; total: number; page: number; limit: number; totalPages: number }>(this.base, { params });
    }
    getAllAdmin() { return this.http.get<any[]>(`${this.base}/all`); }
    getBySlug(slug: string) { return this.http.get<any>(`${this.base}/${slug}`); }
    create(data: any) { return this.http.post<any>(this.base, data); }
    update(id: string, data: any) { return this.http.put<any>(`${this.base}/${id}`, data); }
    unpublish(id: string, adminNote?: string) { return this.http.patch<any>(`${this.base}/${id}/unpublish`, { adminNote }); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }

    // Comments
    getComments(blogId: string) { return this.http.get<any[]>(`${this.commentsBase}/post/${blogId}`); }
    getCommentCount(blogId: string) { return this.http.get<{ count: number }>(`${this.commentsBase}/post/${blogId}/count`); }
    submitComment(blogId: string, data: { authorName: string; authorEmail: string; content: string }) {
        return this.http.post<any>(`${this.commentsBase}/post/${blogId}`, data);
    }
    // Admin comments
    getPendingComments() { return this.http.get<any[]>(`${this.commentsBase}/pending`); }
    getAllComments() { return this.http.get<any[]>(`${this.commentsBase}`); }
    approveComment(id: string) { return this.http.patch(`${this.commentsBase}/${id}/approve`, {}); }
    unapproveComment(id: string, adminNote?: string) { return this.http.patch(`${this.commentsBase}/${id}/unapprove`, { adminNote }); }
    deleteComment(id: string) { return this.http.delete(`${this.commentsBase}/${id}`); }
}
