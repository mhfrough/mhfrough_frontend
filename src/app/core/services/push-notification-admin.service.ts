import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PushNotificationLog {
    id: string;
    title: string;
    body: string;
    url: string | null;
    source: 'inquiry' | 'feedback' | 'comment' | 'chat' | 'admin';
    status: 'success' | 'partial' | 'failed' | 'skipped';
    sentCount: number;
    failedCount: number;
    errorMessage: string | null;
    createdAt: string;
}

export interface SendPushDto {
    title: string;
    body: string;
    url?: string;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationAdminService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin`;

    send(dto: SendPushDto): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.base}/push/send`, dto);
    }

    getLogs(limit = 100): Observable<PushNotificationLog[]> {
        return this.http.get<PushNotificationLog[]>(`${this.base}/push/logs`, {
            params: { limit: String(limit) },
        });
    }
}
