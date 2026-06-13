import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DatasetInfo {
    key: string;
    label: string;
    note: string | null;
    count: number;
}

export interface WipeRequest {
    password: string;
    confirm: string;
    datasets: string[];
}

export interface WipeResult {
    message: string;
    cleared: Record<string, number>;
}

/** Phrase the operator must type to confirm a destructive wipe (matches backend). */
export const WIPE_CONFIRM_PHRASE = 'DELETE';

@Injectable({ providedIn: 'root' })
export class AdminDataService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin/data`;

    datasets(): Observable<DatasetInfo[]> {
        return this.http.get<DatasetInfo[]>(`${this.base}/datasets`);
    }

    export(): Observable<unknown> {
        return this.http.get(`${this.base}/export`);
    }

    wipe(body: WipeRequest): Observable<WipeResult> {
        return this.http.post<WipeResult>(`${this.base}/wipe`, body);
    }
}
