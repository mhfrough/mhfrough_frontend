import { Component, HostListener, inject, signal, computed, viewChild, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { ViewportScroller, isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ChatWidgetComponent } from '../../../shared/chat-widget/chat-widget.component';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FcmService } from '../../../core/services/fcm.service';
import { CookieConsentComponent } from '../../../shared/cookie-consent/cookie-consent.component';
import { FooterSettingsService } from '../../../core/services/footer-settings.service';
import { ExternalUrlPipe } from '../../../shared/pipes/external-url.pipe';
import { TickerBannerComponent } from '../../../shared/ticker-banner/ticker-banner.component';
import { FrontToastComponent } from '../../../shared/components/front-toast/front-toast.component';
import { VisitorTrackingService } from '../../../core/services/visitor-tracking.service';
import { WidgetsCarouselComponent } from '../../../shared/widgets-carousel/widgets-carousel.component';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ChatWidgetComponent, CookieConsentComponent, ExternalUrlPipe, TickerBannerComponent, FrontToastComponent, WidgetsCarouselComponent],
    templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
    readonly showBackToTop = signal(false);
    readonly navOpen = signal(false);
    readonly year = new Date().getFullYear();

    private readonly scroller = inject(ViewportScroller);
    private readonly realtime = inject(RealtimeService);
    private readonly fcm = inject(FcmService);
    private readonly platformId = inject(PLATFORM_ID);
    readonly footerSettings = inject(FooterSettingsService);
    private readonly tracker = inject(VisitorTrackingService);
    private readonly router = inject(Router);
    private trackingSub = new Subscription();
    private permissionTimer: ReturnType<typeof setTimeout> | null = null;

    ngOnInit() {
        this.scroller.setOffset([0, 80]);
        this.realtime.connect();
        this.footerSettings.load();

        // Visitor tracking — browser only
        if (isPlatformBrowser(this.platformId)) {
            this.tracker.init();
            this.trackingSub.add(
                this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                    .subscribe((e) => this.tracker.ping((e as NavigationEnd).urlAfterRedirects)),
            );
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        }

        if (isPlatformBrowser(this.platformId)) {
            this.permissionTimer = setTimeout(() => {
                if (this.fcm.permissionState === 'default') {
                    this.fcm.requestPermissionAndRegister();
                }
            }, 10000);
        }
    }

    ngOnDestroy() {
        if (this.permissionTimer !== null) clearTimeout(this.permissionTimer);
        this.tracker.sendLeave();
        this.trackingSub.unsubscribe();
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    @HostListener('window:beforeunload')
    onBeforeUnload() { this.tracker.sendLeave(); }

    private readonly onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') this.tracker.sendLeave();
    };

    @HostListener('window:scroll')
    onScroll() { this.showBackToTop.set(window.scrollY > 500); }

    @HostListener('document:click')
    onDocumentClick() { this.footerOverflowOpen.set(false); }

    scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    toggleNav() { this.navOpen.update(v => !v); }

    // --- Main navigation (used by the "More" bottom sheet + footer nav) -------
    readonly mainNavItems: { label: string; link: string; fragment?: string; icon: string }[] = [
        { label: 'About', link: '/', fragment: 'about', icon: 'bi-person' },
        { label: 'Projects', link: '/projects', icon: 'bi-briefcase' },
        { label: 'Gallery', link: '/gallery', icon: 'bi-images' },
        { label: 'Services', link: '/', fragment: 'services', icon: 'bi-stars' },
        { label: 'Writing', link: '/blog', icon: 'bi-pencil-square' },
        { label: 'Reviews', link: '/feedback', icon: 'bi-star' },
        { label: 'Work with me', link: '/contact', icon: 'bi-envelope-paper' },
    ];

    // --- Chat widget integration (mobile floating tab bar) --------------------
    readonly chatWidgetRef = viewChild(ChatWidgetComponent);
    readonly chatUnread = computed(() => this.chatWidgetRef()?.unreadCount() ?? 0);
    readonly chatOpen = computed(() => this.chatWidgetRef()?.open() ?? false);

    toggleChat() {
        this.chatWidgetRef()?.toggle();
    }

    isSocialVisible(key: string, place: 'footer' | 'contact' = 'footer'): boolean {
        const vis = this.footerSettings.data().socialVisibility;
        return vis?.[key]?.[place] !== false;
    }

    private readonly SOCIAL_KEYS = [
        { key: 'github', icon: 'bi-github', label: 'GitHub' },
        { key: 'linkedin', icon: 'bi-linkedin', label: 'LinkedIn' },
        { key: 'twitter', icon: 'bi-twitter-x', label: 'X / Twitter' },
        { key: 'instagram', icon: 'bi-instagram', label: 'Instagram' },
        { key: 'youtube', icon: 'bi-youtube', label: 'YouTube' },
        { key: 'medium', icon: 'bi-medium', label: 'Medium' },
        { key: 'dribbble', icon: 'bi-dribbble', label: 'Dribbble' },
        { key: 'stackoverflow', icon: 'bi-stack-overflow', label: 'Stack Overflow' },
        { key: 'discord', icon: 'bi-discord', label: 'Discord' },
        { key: 'website', icon: 'bi-globe2', label: 'Website' },
    ] as const;

    readonly FOOTER_LINK_LIMIT = 5;

    readonly visibleFooterLinks = computed(() => {
        const data = this.footerSettings.data();
        const vis = data.socialVisibility;
        return this.SOCIAL_KEYS
            .filter(s => (data as any)[s.key] && vis?.[s.key]?.['footer'] !== false)
            .map(s => ({ ...s, href: (data as any)[s.key] as string }));
    });

    readonly footerLinksMain = computed(() =>
        this.visibleFooterLinks().slice(0, this.FOOTER_LINK_LIMIT)
    );

    readonly footerLinksOverflow = computed(() =>
        this.visibleFooterLinks().slice(this.FOOTER_LINK_LIMIT)
    );

    readonly footerOverflowOpen = signal(false);

    toggleFooterOverflow() {
        this.footerOverflowOpen.update(v => !v);
    }

    closeFooterOverflow() {
        this.footerOverflowOpen.set(false);
    }
}
