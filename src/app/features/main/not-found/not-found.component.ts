import { Component, inject, signal, OnInit, afterNextRender } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
    selector: 'app-not-found',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './not-found.component.html',
})
export class NotFoundComponent implements OnInit {
    private location = inject(Location);
    private router = inject(Router);
    private readonly activityLog = inject(ActivityLogService);
    private readonly seo = inject(SeoService);
    readonly currentUrl = signal('');

    constructor() {
        // afterNextRender is guaranteed client-only — no isPlatformBrowser guard needed.
        // Reads history state so blog-detail can pass the real bad URL as { from: '/blog/slug' }.
        afterNextRender(() => {
            const state = this.location.getState() as { from?: string } | null;
            const url = state?.from ?? this.router.url;
            this.currentUrl.set(url);
            this.activityLog.reportPageNotFound(url).subscribe({ error: () => { } });
        });
    }

    ngOnInit() {
        this.seo.update({
            title: 'Page Not Found | Mohammad Hamza',
            description: 'The page you are looking for does not exist or has been moved.',
            noIndex: true,
        });
        // Set URL for SSR render (no logging — afterNextRender handles client-side logging)
        const state = this.location.getState() as { from?: string } | null;
        this.currentUrl.set(state?.from ?? this.router.url);
    }

    goBack() {
        this.location.back();
    }
}
