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
        return document.cookie.includes('access_token') ||
            !!sessionStorage.getItem('admin_session');
    }

    isLoggedIn(): boolean { return this._loggedIn(); }

    login(email: string, password: string) {
        return this.http.post(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
            tap(() => {
                sessionStorage.setItem('admin_session', '1');
                this._loggedIn.set(true);
            }),
        );
    }

    logout() {
        return this.http.post(`${environment.apiUrl}/auth/logout`, {}).pipe(
            tap(() => {
                sessionStorage.removeItem('admin_session');
                this._loggedIn.set(false);
                this.router.navigate(['/admin/login']);
            }),
        );
    }

    forceLogout() {
        sessionStorage.removeItem('admin_session');
        this._loggedIn.set(false);
        this.router.navigate(['/admin/login']);
    }

    getProfile() {
        return this.http.get(`${environment.apiUrl}/auth/profile`);
    }
}
