import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface TickerMessage {
    id: string;
    message: string;
    isPublished: boolean;
    autoDeactivateAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TickerPage {
    data: TickerMessage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class TickerService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/ticker`;

    /** Public: only published tickers */
    getPublished() {
        return this.http.get<TickerMessage[]>(this.base);
    }

    /** Admin: paginated + search */
    getAll(page = 1, limit = 10, q?: string) {
        const params: Record<string, string> = { page: String(page), limit: String(limit) };
        if (q) params['q'] = q;
        return this.http.get<TickerPage>(`${this.base}/admin`, { params });
    }

    create(data: { message: string; isPublished?: boolean; autoDeactivateAt?: string | null }) {
        return this.http.post<TickerMessage>(this.base, data);
    }

    update(id: string, data: Partial<TickerMessage>) {
        return this.http.patch<TickerMessage>(`${this.base}/${id}`, data);
    }

    remove(id: string) {
        return this.http.delete(`${this.base}/${id}`);
    }
}
