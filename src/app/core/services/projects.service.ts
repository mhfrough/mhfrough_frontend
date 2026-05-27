import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/projects`;

    uploadImage(file: File) {
        const fd = new FormData();
        fd.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, fd);
    }

    getAll() { return this.http.get<any[]>(this.base); }
    getFeatured() { return this.http.get<any[]>(`${this.base}/featured`); }
    getAllAdmin() { return this.http.get<any[]>(`${this.base}/all`); }
    getOne(id: string) { return this.http.get<any>(`${this.base}/${id}`); }
    getBySlug(slug: string) { return this.http.get<any>(`${this.base}/slug/${slug}`); }
    create(data: any) { return this.http.post<any>(this.base, data); }
    update(id: string, data: any) { return this.http.put<any>(`${this.base}/${id}`, data); }
    patchFeatured(id: string, featured: boolean) { return this.http.patch<any>(`${this.base}/${id}/featured`, { featured }); }
    unpublish(id: string, adminNote?: string) { return this.http.patch<any>(`${this.base}/${id}/unpublish`, { adminNote }); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}
