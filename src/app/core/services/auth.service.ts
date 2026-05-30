import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly _loggedIn = signal<boolean>(this.checkCookie());
    /** Public read-only signal for logged-in state (templates can call `auth.loggedIn()`) */
    readonly loggedIn = this._loggedIn;

    // log changes to the signal for debugging
    constructorLog(): void {
        try {
            effect(() => {
                const v = this._loggedIn();
                if (typeof console !== 'undefined' && console.debug) console.debug('[AuthService] loggedIn ->', v);
                return v;
            });
        } catch {}
    }

    constructor() {
        // React to cross-tab/local changes and when the user returns focus to the page
        if (isPlatformBrowser(this.platformId)) {
            try {
                window.addEventListener('focus', () => this._loggedIn.set(this.checkCookie()));
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) this._loggedIn.set(this.checkCookie());
                });
                window.addEventListener('storage', (e: StorageEvent) => {
                    if (!e.key) return;
                    if (e.key === 'admin_session' || e.key === 'admin_remember_me' || e.key === 'admin_rm') {
                        this._loggedIn.set(this.checkCookie());
                    }
                });
            } catch {}
        }
        // start the debug effect
        this.constructorLog();
    }

    private getCookie(name: string): string | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        const safe = name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1');
        const match = document.cookie.match(new RegExp('(?:^|; )' + safe + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    }

    private checkCookie(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;

        const hasAccessToken = !!this.getCookie('access_token');
        const hasAdminRmCookie = this.getCookie('admin_rm') === '1';
        const hasSession = !!sessionStorage.getItem('admin_session');
        const hasRememberLocal = localStorage.getItem('admin_remember_me') === '1' || localStorage.getItem('admin_rm') === '1';

        return hasAccessToken || hasAdminRmCookie || hasSession || hasRememberLocal;
    }

    isLoggedIn(): boolean { return this._loggedIn(); }

    /** Returns true when the user signed in with "Remember Me" */
    isRememberMe(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        return localStorage.getItem('admin_remember_me') === '1' ||
            localStorage.getItem('admin_rm') === '1' ||
            this.getCookie('admin_rm') === '1';
    }

    login(email: string, password: string, rememberMe = false) {
        return this.http.post(`${environment.apiUrl}/auth/login`, { email, password, rememberMe }).pipe(
            tap(() => {
                if (rememberMe) {
                    localStorage.setItem('admin_remember_me', '1');
                } else {
                    localStorage.removeItem('admin_remember_me');
                }
                sessionStorage.setItem('admin_session', '1');
                this._loggedIn.set(true);
            }),
        );
    }

    logout() {
        return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
            tap(() => {
                sessionStorage.removeItem('admin_session');
                localStorage.removeItem('admin_remember_me');
                this._loggedIn.set(false);
                this.router.navigate(['/admin/login']);
            }),
        );
    }

    forceLogout() {
        sessionStorage.removeItem('admin_session');
        localStorage.removeItem('admin_remember_me');
        this._loggedIn.set(false);
        this.router.navigate(['/admin/login']);
    }

    getProfile() {
        return this.http.get(`${environment.apiUrl}/auth/profile`);
    }
}
