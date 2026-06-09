import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface UserInfo {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    role?: string;
}

/** Single localStorage key shared across all public forms (contact, feedback, comments) */
const LS_KEY = 'mhf_contact_user';

@Injectable({ providedIn: 'root' })
export class UserInfoService {
    private readonly platformId = inject(PLATFORM_ID);

    get(): UserInfo | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        try {
            const raw = localStorage.getItem(LS_KEY);
            return raw ? (JSON.parse(raw) as UserInfo) : null;
        } catch {
            return null;
        }
    }

    save(info: Partial<UserInfo>): void {
        if (!isPlatformBrowser(this.platformId)) return;
        try {
            const existing = this.get() ?? { name: '', email: '' };
            localStorage.setItem(LS_KEY, JSON.stringify({ ...existing, ...info }));
        } catch { /* ignore */ }
    }
}
