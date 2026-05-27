import { Component, inject, signal, OnInit, afterNextRender } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ActivityLogService } from '../../../core/services/activity-log.service';

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
        // Set URL for SSR render (no logging — afterNextRender handles client-side logging)
        const state = this.location.getState() as { from?: string } | null;
        this.currentUrl.set(state?.from ?? this.router.url);
    }

    goBack() {
        this.location.back();
    }
}
