import { Component, HostListener, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { VisitorTrackingService } from '../../../core/services/visitor-tracking.service';

interface CreditPill {
    label: string;
    href: string;
}

@Component({
    selector: 'app-seo-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, CommonModule],
    templateUrl: './seo-layout.component.html',
    styleUrl: './seo-layout.component.scss',
})
export class SeoLayoutComponent implements OnInit, OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly tracker = inject(VisitorTrackingService);
    private readonly router = inject(Router);
    private trackingSub = new Subscription();

    readonly year = new Date().getFullYear();
    readonly scrolled = signal(false);

    readonly builtWith: CreditPill[] = [
        { label: 'cheerio', href: 'https://www.npmjs.com/package/cheerio' },
    ];

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            this.tracker.init();
            this.trackingSub.add(
                this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                    .subscribe((e) => this.tracker.ping((e as NavigationEnd).urlAfterRedirects)),
            );
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        }
    }

    ngOnDestroy() {
        this.tracker.sendLeave();
        this.trackingSub.unsubscribe();
        if (isPlatformBrowser(this.platformId)) {
            document.removeEventListener('visibilitychange', this.onVisibilityChange);
        }
    }

    @HostListener('window:beforeunload')
    onBeforeUnload() { this.tracker.sendLeave(); }

    @HostListener('window:scroll')
    onScroll() { this.scrolled.set(window.scrollY > 8); }

    private readonly onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') this.tracker.sendLeave();
    };
}
