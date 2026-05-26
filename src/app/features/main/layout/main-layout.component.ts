import { Component, HostListener, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ViewportScroller, isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { ChatWidgetComponent } from '../../../shared/chat-widget/chat-widget.component';
import { RealtimeService } from '../../../core/services/realtime.service';
import { FcmService } from '../../../core/services/fcm.service';
import { CookieConsentComponent } from '../../../shared/cookie-consent/cookie-consent.component';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, ChatWidgetComponent, CookieConsentComponent],
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
    private permissionTimer: ReturnType<typeof setTimeout> | null = null;

    ngOnInit() {
        this.scroller.setOffset([0, 80]);
        this.realtime.connect();

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
        // realtime stays connected across navigation; disconnect only when leaving the site
    }

    @HostListener('window:scroll')
    onScroll() { this.showBackToTop.set(window.scrollY > 500); }

    scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    toggleNav() { this.navOpen.update(v => !v); }
}
