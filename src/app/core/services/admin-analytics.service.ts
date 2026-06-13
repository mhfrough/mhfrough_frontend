import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DailyPoint { day: string; count: number; }
export interface DailyAmount { day: string; amount: number; }

export interface AnalyticsOverview {
    range: { days: number; from: string; to: string };
    series: {
        inquiries: DailyPoint[];
        leads: DailyPoint[];
        feedback: DailyPoint[];
        comments: DailyPoint[];
        revenue: DailyAmount[];
    };
    leadsByStatus: Record<string, number>;
    feedbackByRating: Record<string, number>;
    inquiriesByStatus: Record<string, number>;
    totals: {
        projects: number;
        blogs: number;
        inquiries: number;
        feedback: number;
        comments: number;
        leads: number;
        paidRevenue: number;
    };
}

@Injectable({ providedIn: 'root' })
export class AdminAnalyticsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/admin/analytics`;

    overview(days = 30): Observable<AnalyticsOverview> {
        return this.http.get<AnalyticsOverview>(`${this.base}?days=${days}`);
    }
}
