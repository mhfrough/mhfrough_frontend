import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InquiriesService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/inquiries`;

    submit(data: any) { return this.http.post<any>(this.base, data); }
    getAll() { return this.http.get<any[]>(this.base); }
    markRead(id: string) { return this.http.patch(`${this.base}/${id}/read`, {}); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/feedback`;

    getApproved() { return this.http.get<any[]>(this.base); }
    getAll() { return this.http.get<any[]>(`${this.base}/all`); }
    submit(data: any) { return this.http.post<any>(this.base, data); }
    approve(id: string) { return this.http.patch(`${this.base}/${id}/approve`, {}); }
    unapprove(id: string, adminNote?: string) { return this.http.patch(`${this.base}/${id}/unapprove`, { adminNote }); }
    remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
}
