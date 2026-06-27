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
    // Widget API Keys
    weatherApiKey: string | null;
    goldApiKey: string | null;
    currencyApiKey: string | null;
    weatherCity: string;
    // AI Chat Auto-Reply
    geminiApiKey: string | null;
    aiEnabled: boolean;
    aiTone: string;
    aiInstruction: string | null;
    aiAutoReplyDelay: number;
    aiMaxResponseLength: number;
    aiMaxQuestions: number;
    // Deployment Health
    githubToken: string | null;
    githubRepoBackend: string | null;
    githubRepoFrontend: string | null;
    renderApiKey: string | null;
    renderServiceIdBackend: string | null;
    renderServiceIdFrontend: string | null;
    renderPostgresId: string | null;
    // Email (Resend)
    resendApiKey: string | null;
    emailFromAddress: string | null;
    emailFromName: string;
    emailEnabled: boolean;
    // Visitor Authentication (OAuth)
    visitorAuthEnabled: boolean;
    googleOAuthEnabled: boolean;
    googleClientId: string | null;
    googleClientSecret: string | null;
    githubOAuthEnabled: boolean;
    githubClientId: string | null;
    githubClientSecret: string | null;
    linkedinOAuthEnabled: boolean;
    linkedinClientId: string | null;
    linkedinClientSecret: string | null;
    discordOAuthEnabled: boolean;
    discordClientId: string | null;
    discordClientSecret: string | null;
    updatedAt: string;
}

export interface RenderPostgresInfo {
    name?: string;
    status?: string;
    plan?: string;
    region?: string;
    version?: number;
    createdAt?: string;
    error?: 'not_configured' | 'fetch_failed';
}

export interface DeploymentOverview {
    github: {
        backend: GithubCommitInfo;
        frontend: GithubCommitInfo;
    };
    render: {
        backend: RenderStatusInfo;
        frontend: RenderStatusInfo;
        postgres: RenderPostgresInfo;
    };
    integrations: {
        supabase: boolean;
        firebase: boolean;
    };
}

export interface GithubCommitInfo {
    sha?: string;
    message?: string;
    author?: string;
    date?: string;
    url?: string;
    repo?: string;
    error?: 'not_configured' | 'fetch_failed';
}

export interface RenderStatusInfo {
    status?: string;
    createdAt?: string;
    finishedAt?: string;
    commitMessage?: string;
    error?: 'not_configured' | 'fetch_failed';
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
    footerTagline: 'Made with \u2665 in Karāchi',
    showFooterTagline: true,
    weatherApiKey: null,
    goldApiKey: null,
    currencyApiKey: null,
    weatherCity: 'Karachi',
    geminiApiKey: null,
    aiEnabled: false,
    aiTone: 'professional',
    aiInstruction: null,
    aiAutoReplyDelay: 1500,
    aiMaxResponseLength: 300,
    aiMaxQuestions: 12,
    githubToken: null,
    githubRepoBackend: null,
    githubRepoFrontend: null,
    renderApiKey: null,
    renderServiceIdBackend: null,
    renderServiceIdFrontend: null,
    renderPostgresId: null,
    resendApiKey: null,
    emailFromAddress: null,
    emailFromName: 'Mohammad Hamza',
    emailEnabled: false,
    visitorAuthEnabled: false,
    googleOAuthEnabled: false,
    googleClientId: null,
    googleClientSecret: null,
    githubOAuthEnabled: false,
    githubClientId: null,
    githubClientSecret: null,
    linkedinOAuthEnabled: false,
    linkedinClientId: null,
    linkedinClientSecret: null,
    discordOAuthEnabled: false,
    discordClientId: null,
    discordClientSecret: null,
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

    getDeploymentOverview() {
        return this.http.get<DeploymentOverview>(`${environment.apiUrl}/health/deployment`);
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
        return this.http.post<{ url: string }>(`${environment.apiUrl}/upload/image?type=profile`, form);
    }
}
