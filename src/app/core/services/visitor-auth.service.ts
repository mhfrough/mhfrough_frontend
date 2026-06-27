import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface VisitorProfile {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    provider: string;
    createdAt: string;
    lastLoginAt: string | null;
}

export interface EnabledProvider {
    provider: string;
    label: string;
}

const PROVIDER_LABELS: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    discord: 'Discord',
};

const SESSION_KEY = 'visitor_session';

@Injectable({ providedIn: 'root' })
export class VisitorAuthService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly router = inject(Router);

    readonly visitorProfile = signal<VisitorProfile | null>(null);
    readonly enabledProviders = signal<EnabledProvider[]>([]);
    readonly loaded = signal(false);

    private _initDone = false;

    /** Safe to call multiple times — only runs once per page load. */
    init() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this._initDone) return;
        this._initDone = true;
        this.loadProviders();

        // Check URL params set by the OAuth callback redirect
        const params = new URLSearchParams(window.location.search);
        if (params.has('visitor_login')) {
            // Just came back from OAuth — fetch profile and clean URL
            this.loadProfile();
            params.delete('visitor_login');
            const clean = params.toString() ? `?${params}` : window.location.pathname;
            history.replaceState({}, '', clean);
            return;
        }
        if (params.has('auth_error')) {
            params.delete('auth_error');
            const clean = params.toString() ? `?${params}` : window.location.pathname;
            history.replaceState({}, '', clean);
        }

        // Only make the /me API call if we have an active session flag
        if (localStorage.getItem(SESSION_KEY) === '1') {
            this.loadProfile();
        } else {
            this.loaded.set(true);
        }
    }

    private loadProfile() {
        this.http.get<VisitorProfile | null>(`${environment.apiUrl}/visitor-auth/me`).subscribe({
            next: (p) => {
                this.visitorProfile.set(p);
                if (p) {
                    localStorage.setItem(SESSION_KEY, '1');
                } else {
                    localStorage.removeItem(SESSION_KEY);
                }
                this.loaded.set(true);
            },
            error: () => {
                this.visitorProfile.set(null);
                localStorage.removeItem(SESSION_KEY);
                this.loaded.set(true);
            },
        });
    }

    private loadProviders() {
        this.http.get<EnabledProvider[]>(`${environment.apiUrl}/visitor-auth/providers`).subscribe({
            next: (p) => this.enabledProviders.set(p ?? []),
            error: () => this.enabledProviders.set([]),
        });
    }

    loginWith(provider: string) {
        if (!isPlatformBrowser(this.platformId)) return;
        window.location.href = `${environment.apiUrl}/visitor-auth/${provider}`;
    }

    logout() {
        return this.http.post(`${environment.apiUrl}/visitor-auth/logout`, {}).pipe(
            tap(() => {
                this.visitorProfile.set(null);
                localStorage.removeItem(SESSION_KEY);
            }),
        );
    }

    providerLabel(provider: string | null | undefined): string {
        if (!provider) return '';
        return `via ${PROVIDER_LABELS[provider] ?? provider}`;
    }
}
