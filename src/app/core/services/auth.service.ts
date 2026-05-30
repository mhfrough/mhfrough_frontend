import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
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

    private checkCookie(): boolean {
        if (!isPlatformBrowser(this.platformId)) return false;
        try {
            const cookie = typeof document !== 'undefined' ? document.cookie : '';
            return cookie.includes('access_token') ||
                cookie.includes('admin_rm') ||
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
