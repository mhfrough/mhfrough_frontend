import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface FooterSettings {
    copyrightOwner: string;
    footerTagline: string;
    showFooterTagline: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    aboutHtml: string | null;
    location: string | null;
    contactEmail: string | null;
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
}

const DEFAULTS: FooterSettings = {
    copyrightOwner: 'mhfrough.dev',
    footerTagline: 'Made with \u2665 in Karachi',
    showFooterTagline: true,
    displayName: null,
    avatarUrl: null,
    aboutHtml: null,
    location: null,
    contactEmail: null,
    website: null,
    github: null,
    linkedin: null,
    twitter: null,
    instagram: null,
    youtube: null,
    discord: null,
    stackoverflow: null,
    medium: null,
    dribbble: null,
    socialVisibility: null,
};

@Injectable({ providedIn: 'root' })
export class FooterSettingsService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    readonly data = signal<FooterSettings>(DEFAULTS);

    load() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.http.get<FooterSettings>(`${environment.apiUrl}/site-settings/footer`).pipe(
            tap(d => this.data.set(d)),
        ).subscribe({ error: () => { } });
    }
}
