import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IdbService } from './idb.service';

export interface GalleryItem {
    id: string;
    title?: string;
    caption?: string;
    mediaUrl: string;
    mediaType: 'image' | 'video' | 'gif';
    category?: string;
    tags?: string[];
    isPublished: boolean;
    altText?: string;
    mimeType?: string;
    fileSize?: number;
    createdAt: string;
    updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class GalleryService {
    private readonly http = inject(HttpClient);
    private readonly idb = inject(IdbService);
    private readonly base = `${environment.apiUrl}/gallery`;

    uploadMedia(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string; mimeType: string; fileSize: number; mediaType: string }>(
            `${environment.apiUrl}/upload/media?type=gallery`, fd
        );
    }

    getAll() { return this.http.get<GalleryItem[]>(this.base); }
    getAllAdmin() { return this.http.get<GalleryItem[]>(`${this.base}/all`); }

    getPublicPaginated(page: number, limit: number, q?: string, category?: string, tag?: string): Observable<{ data: GalleryItem[]; total: number; page: number; limit: number; totalPages: number }> {
        const params: Record<string, string> = { page: String(page), limit: String(limit) };
        if (q) params['q'] = q;
        if (category && category !== 'all') params['category'] = category;
        if (tag && tag !== 'all') params['tag'] = tag;
        return new Observable(subscriber => {
            if (page === 1 && !q && !category && !tag) {
                this.idb.getAll<GalleryItem>('gallery').then(cached => {
                    if (cached.length) {
                        subscriber.next({ data: cached.slice(0, limit), total: cached.length, page: 1, limit, totalPages: Math.ceil(cached.length / limit) });
                    }
                });
            }
            this.http.get<{ data: GalleryItem[]; total: number; page: number; limit: number; totalPages: number }>(this.base, { params }).subscribe({
                next: fresh => {
                    if (page === 1 && !q && !category && !tag) {
                        this.idb.putMany('gallery', fresh.data).catch(() => {});
                    }
                    subscriber.next(fresh);
                    subscriber.complete();
                },
                error: err => subscriber.error(err),
            });
        });
    }

    getCategories() { return this.http.get<string[]>(`${this.base}/categories`); }
    getTags() { return this.http.get<string[]>(`${this.base}/tags`); }
    getOne(id: string) { return this.http.get<GalleryItem>(`${this.base}/${id}`); }
    create(data: Partial<GalleryItem>) { return this.http.post<GalleryItem>(this.base, data); }
    update(id: string, data: Partial<GalleryItem>) { return this.http.put<GalleryItem>(`${this.base}/${id}`, data); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}
