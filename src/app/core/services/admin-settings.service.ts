import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AdminSettings {
    id: number;
    enableInactivityLogout: boolean;
    inactivityTimeoutMinutes: number;
    enableLoginAttemptSuspend: boolean;
    maxLoginAttempts: number;
    lockDurationMinutes: number;
    rememberMeDays: number;
    sessionDurationDays: number;
    // Footer / Branding
    copyrightOwner: string;
    footerTagline: string;
    showFooterTagline: boolean;
    updatedAt: string;
}

export interface LoginSession {
    id: string;
    userId: string;
    ip: string | null;
    userAgent: string | null;
    browser: string | null;
    os: string | null;
    country: string | null;
    city: string | null;
    isActive: boolean;
    revokedAt: string | null;
    loginAt: string;
}

export interface AdminProfile {
    id: string;
    email: string;
    role: string;
    displayName: string | null;
    bio: string | null;
    aboutHtml: string | null;
    avatarUrl: string | null;
    contactEmail: string | null;
    phone: string | null;
    location: string | null;
    timezone: string | null;
    website: string | null;
    github: string | null;
    linkedin: string | null;
    twitter: string | null;
    instagram: string | null;
    youtube: string | null;
    discord: string | null;
    stackoverflow: string | null;
    medium: string | null;
    dribbble: string | null;
    socialVisibility: Record<string, { footer: boolean; contact: boolean }> | null;
    createdAt: string;
    updatedAt: string;
}

const DEFAULTS: AdminSettings = {
    id: 1,
    enableInactivityLogout: true,
    inactivityTimeoutMinutes: 10,
    enableLoginAttemptSuspend: true,
    maxLoginAttempts: 3,
    lockDurationMinutes: 180,
    rememberMeDays: 30,
    sessionDurationDays: 1,
    copyrightOwner: 'mhfrough.dev',
    footerTagline: 'Made with \u2665 in Karachi',
    showFooterTagline: true,
    updatedAt: '',
};

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    readonly settings = signal<AdminSettings>(DEFAULTS);
    readonly loaded = signal(false);
    readonly sessions = signal<LoginSession[]>([]);
    readonly currentSessionId = signal<string | null>(null);
    readonly profile = signal<AdminProfile | null>(null);

    load() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.http.get<AdminSettings>(`${environment.apiUrl}/admin/settings`).subscribe({
            next: (s) => { this.settings.set(s); this.loaded.set(true); },
            error: () => { this.loaded.set(true); },
        });
    }

    update(dto: Partial<AdminSettings>) {
        return this.http.patch<AdminSettings>(`${environment.apiUrl}/admin/settings`, dto).pipe(
            tap(s => this.settings.set(s)),
        );
    }

    loadSessions() {
        return this.http.get<{ sessions: LoginSession[]; currentSessionId: string | null }>(
            `${environment.apiUrl}/admin/settings/sessions`
        ).pipe(
            tap(res => {
                this.sessions.set(res.sessions);
                this.currentSessionId.set(res.currentSessionId);
            }),
        );
    }

    revokeSession(id: string) {
        return this.http.delete(`${environment.apiUrl}/admin/settings/sessions/${id}`).pipe(
            tap(() => this.sessions.update(list => list.map(s => s.id === id ? { ...s, isActive: false, revokedAt: new Date().toISOString() } : s))),
        );
    }

    revokeAllSessions() {
        return this.http.delete(`${environment.apiUrl}/admin/settings/sessions/all`).pipe(
            tap(() => this.sessions.update(list => list.map(s => ({ ...s, isActive: false, revokedAt: new Date().toISOString() })))),
        );
    }

    clearRevokedSessions() {
        return this.http.delete(`${environment.apiUrl}/admin/settings/sessions/revoked`).pipe(
            tap(() => this.sessions.update(list => list.filter(s => s.isActive))),
        );
    }

    changePassword(currentPassword: string, newPassword: string) {
        return this.http.post(`${environment.apiUrl}/admin/settings/change-password`, { currentPassword, newPassword });
    }

    loadProfile() {
        return this.http.get<AdminProfile>(`${environment.apiUrl}/admin/settings/profile`).pipe(
            tap(p => this.profile.set(p)),
        );
    }

    updateProfile(dto: Partial<AdminProfile>) {
        return this.http.patch<AdminProfile>(`${environment.apiUrl}/admin/settings/profile`, dto).pipe(
            tap(p => this.profile.set(p)),
        );
    }

    uploadAvatar(file: File) {
        const form = new FormData();
        form.append('file', file);
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image`, form);
    }
}
