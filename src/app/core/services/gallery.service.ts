import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OfflineResourceService, Paginated } from './offline-resource.service';

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
export class GalleryService extends OfflineResourceService {
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

    getPublicPaginated(page: number, limit: number, q?: string, category?: string, tag?: string): Observable<Paginated<GalleryItem>> {
        const params: Record<string, string> = { page: String(page), limit: String(limit) };
        if (q) params['q'] = q;
        if (category && category !== 'all') params['category'] = category;
        if (tag && tag !== 'all') params['tag'] = tag;
        return this.staleList<GalleryItem>({
            store: 'gallery',
            cacheable: page === 1 && !q && !category && !tag,
            limit,
            fetch: () => this.http.get<Paginated<GalleryItem>>(this.base, { params }),
        });
    }

    getCategories() { return this.http.get<string[]>(`${this.base}/categories`); }
    getTags() { return this.http.get<string[]>(`${this.base}/tags`); }
    getOne(id: string) { return this.http.get<GalleryItem>(`${this.base}/${id}`); }

    create(data: Partial<GalleryItem>) { return this.mutate('POST', this.base, data); }
    update(id: string, data: Partial<GalleryItem>) { return this.mutate('PUT', `${this.base}/${id}`, data); }
    remove(id: string) { return this.mutate('DELETE', `${this.base}/${id}`); }
}
