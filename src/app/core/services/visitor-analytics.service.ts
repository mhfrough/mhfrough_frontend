import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface VisitorSession {
    id: string;
    fingerprint: string;
    ip: string | null;
    ipVersion: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    deviceType: string | null;
    browser: string | null;
    browserVersion: string | null;
    os: string | null;
    osVersion: string | null;
    screenRes: string | null;
    language: string | null;
    referrer: string | null;
    entryPath: string | null;
    pageViewCount: number;
    sessionDurationMs: number;
    bounced: boolean;
    startedAt: string;
    lastSeenAt: string | null;
}

export interface VisitorPageView {
    id: string;
    sessionId: string;
    path: string | null;
    timeOnPageMs: number | null;
    createdAt: string;
}

export interface VisitorEvent {
    id: string;
    sessionId: string;
    eventName: string;
    path: string | null;
    metadata: Record<string, string> | null;
    createdAt: string;
}

export interface VisitorJourney {
    pageViews: VisitorPageView[];
    events: VisitorEvent[];
}

export interface VisitorStats {
    total: number;
    unique: number;
    bounceRate: number;
    totalPageViews: number;
    topCountries: { country: string; count: string }[];
    topBrowsers: { browser: string; count: string }[];
    deviceDist: { deviceType: string; count: string }[];
    dailySessions: { day: string; count: string }[];
    topPages: { path: string; count: string; avgTimeMs: string }[];
    topEvents: { eventName: string; count: string }[];
}

export interface VisitorListResponse {
    data: VisitorSession[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class VisitorAnalyticsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/visitors`;

    readonly stats = signal<VisitorStats | null>(null);

    loadStats() {
        return this.http.get<VisitorStats>(`${this.base}/stats`);
    }

    list(page: number, limit: number, search?: string) {
        let url = `${this.base}?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        return this.http.get<VisitorListResponse>(url);
    }

    getSession(sessionId: string) {
        return this.http.get<VisitorSession>(`${this.base}/${sessionId}`);
    }

    getJourney(sessionId: string) {
        return this.http.get<VisitorJourney>(`${this.base}/${sessionId}/journey`);
    }

    deleteSession(sessionId: string) {
        return this.http.delete(`${this.base}/${sessionId}`);
    }

    clearAll() {
        return this.http.delete(this.base);
    }
}
