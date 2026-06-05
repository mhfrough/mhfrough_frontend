import { Injectable, signal, PLATFORM_ID, inject, DestroyRef } from '@angular/core';
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
    /** Signal representing explicit admin widget visibility. */
    readonly adminWidgetVisible = signal<boolean>(this.checkAdminWidgetVisible());

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            const handler = (ev: StorageEvent) => {
                // Update the signal when the admin widget key changes in another tab
                if (ev.key === 'admin_widget_visible' || ev.key === null) {
                    this.adminWidgetVisible.set(this.checkAdminWidgetVisible());
                }
            };
            window.addEventListener('storage', handler);
            inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', handler));
        }
    }

    private checkCookie(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        try {
            const cookie = typeof document !== 'undefined' ? document.cookie : '';
            // Only consider admin-specific markers here. `access_token` is
            // used for regular site auth and can cause non-admin users to be
            // treated as signed-in for the admin UI. Use admin cookies/flags
            // instead: `admin_rm`, sessionStorage `admin_session`, or
            // localStorage `admin_remember_me`.
            return cookie.includes('admin_rm') ||
                !!sessionStorage.getItem('admin_session') ||
                localStorage.getItem('admin_remember_me') === '1';
        } catch (e) {
            return false;
        }
    }

    isLoggedIn(): boolean { return this._loggedIn(); }

    /** Returns true when the user signed in with "Remember Me" */
    isRememberMe(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        return localStorage.getItem('admin_remember_me') === '1';
    }

    /** Explicit admin flag for UI (widgets) visibility. */
    private checkAdminWidgetVisible(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        return sessionStorage.getItem('admin_widget_visible') === '1' ||
            localStorage.getItem('admin_widget_visible') === '1';
    }

    // Backwards-compatible accessor (returns current value)
    isAdminSignedIn(): boolean {
        return this.adminWidgetVisible();
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
                // Mark widget-visible flag so UI can rely on an explicit key.
                if (rememberMe) {
                    localStorage.setItem('admin_widget_visible', '1');
                } else {
                    sessionStorage.setItem('admin_widget_visible', '1');
                }
                // Update signal so UI reacts immediately in this tab
                this.adminWidgetVisible.set(true);
                this._loggedIn.set(true);
            }),
        );
    }

    logout() {
        return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
            tap(() => {
                sessionStorage.removeItem('admin_session');
                sessionStorage.removeItem('admin_widget_visible');
                localStorage.removeItem('admin_widget_visible');
                localStorage.removeItem('admin_remember_me');
                // Update signal so UI reacts immediately in this tab
                this.adminWidgetVisible.set(false);
                this._loggedIn.set(false);
                this.router.navigate(['/admin/login']);
            }),
        );
    }

    forceLogout() {
        sessionStorage.removeItem('admin_session');
        sessionStorage.removeItem('admin_widget_visible');
        localStorage.removeItem('admin_widget_visible');
        localStorage.removeItem('admin_remember_me');
        // Update signal so UI reacts immediately in this tab
        this.adminWidgetVisible.set(false);
        this._loggedIn.set(false);
        this.router.navigate(['/admin/login']);
    }

    getProfile() {
        return this.http.get(`${environment.apiUrl}/auth/profile`);
    }
}
