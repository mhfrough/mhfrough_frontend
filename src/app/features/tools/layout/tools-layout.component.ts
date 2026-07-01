import { Component, HostListener, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { VisitorTrackingService } from '../../../core/services/visitor-tracking.service';
import { TOOLS, ToolMeta } from '../tools.config';

interface CreditPill {
    label: string;
    href: string;
}

@Component({
    selector: 'app-tools-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './tools-layout.component.html',
    styleUrl: './tools-layout.component.scss',
})
export class ToolsLayoutComponent implements OnInit, OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    private readonly tracker = inject(VisitorTrackingService);
    private readonly router = inject(Router);
    private trackingSub = new Subscription();

    readonly year = new Date().getFullYear();
    readonly tools: ToolMeta[] = TOOLS;
    readonly liveTools = computed(() => this.tools.filter(t => t.status === 'live'));

    readonly menuOpen = signal(false);

    // npm packages that power the backend tools — credited in the footer.
    readonly builtWith: CreditPill[] = [
        { label: 'html-minifier-terser', href: 'https://www.npmjs.com/package/html-minifier-terser' },
        { label: 'terser', href: 'https://www.npmjs.com/package/terser' },
        { label: 'clean-css', href: 'https://www.npmjs.com/package/clean-css' },
        { label: 'sass', href: 'https://www.npmjs.com/package/sass' },
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

    private readonly onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') this.tracker.sendLeave();
    };

    toggleMenu(event: Event) {
        event.stopPropagation();
        this.menuOpen.update(v => !v);
    }

    @HostListener('document:click')
    onDocumentClick() { this.menuOpen.set(false); }
}
