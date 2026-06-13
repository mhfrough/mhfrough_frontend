import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OfflineResourceService, Paginated } from './offline-resource.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService extends OfflineResourceService {
    private readonly base = `${environment.apiUrl}/projects`;

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=project`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }

    getPublic(page: number, limit: number, q?: string, tag?: string): Observable<Paginated<any>> {
        const params: Record<string, any> = { page, limit };
        if (q) params['q'] = q;
        if (tag && tag !== 'all') params['tag'] = tag;
        return this.staleList<any>({
            store: 'projects',
            cacheable: page === 1 && !q && !tag,
            limit,
            fetch: () => this.http.get<Paginated<any>>(this.base, { params }),
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

    create(data: any) { return this.mutate('POST', this.base, data); }
    update(id: string, data: any) { return this.mutate('PUT', `${this.base}/${id}`, data); }
    patchFeatured(id: string, featured: boolean) { return this.mutate('PATCH', `${this.base}/${id}/featured`, { featured }); }
    unpublish(id: string, adminNote?: string) { return this.mutate('PATCH', `${this.base}/${id}/unpublish`, { adminNote }); }
    remove(id: string) { return this.mutate('DELETE', `${this.base}/${id}`); }
}
