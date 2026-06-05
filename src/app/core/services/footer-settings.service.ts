import { Injectable, inject, signal, PLATFORM_ID, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RealtimeService } from './realtime.service';

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
    footerTagline: 'Made with \u2665 in Karāchi',
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
    private readonly realtime = inject(RealtimeService);
    private readonly destroyRef = inject(DestroyRef);

    readonly data = signal<FooterSettings>(DEFAULTS);
    private realtimeSubscribed = false;
    private realtimeSub?: Subscription;

    load() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.http.get<FooterSettings>(`${environment.apiUrl}/site-settings/footer`).pipe(
            tap(d => this.data.set(d)),
        ).subscribe({ error: () => { } });

        // Reload footer data whenever admin saves profile/links
        if (!this.realtimeSubscribed) {
            this.realtimeSubscribed = true;
            this.realtimeSub = this.realtime.on<Partial<FooterSettings>>('profile:updated').subscribe(() => {
                this.http.get<FooterSettings>(`${environment.apiUrl}/site-settings/footer`).pipe(
                    tap(d => this.data.set(d)),
                ).subscribe({ error: () => { } });
            });
            this.destroyRef.onDestroy(() => this.realtimeSub?.unsubscribe());
        }
    }
}
