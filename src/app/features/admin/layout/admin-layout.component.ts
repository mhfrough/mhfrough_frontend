import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, HostBinding, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AdminFloatingChatComponent } from '../floating-chat/admin-floating-chat.component';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { ChatService } from '../../../core/services/chat.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { InactivityService } from '../../../core/services/inactivity.service';
import { AdminSettingsService } from '../../../core/services/admin-settings.service';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AdminFloatingChatComponent],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    @ViewChild('sidebarNav') sidebarNav?: ElementRef<HTMLUListElement>;
    readonly auth = inject(AuthService);
    readonly notif = inject(AdminNotificationService);
    readonly chat = inject(ChatService);
    readonly inactivity = inject(InactivityService);
    readonly adminSettings = inject(AdminSettingsService);
    private readonly router = inject(Router);
    private readonly realtime = inject(RealtimeService);
    private readonly titleService = inject(Title);
    readonly menuOpen = signal(false);
    private subs = new Subscription();
    private waitForSettingsInterval: ReturnType<typeof setInterval> | null = null;
    private waitForSettingsTimeout: ReturnType<typeof setTimeout> | null = null;

    private static readonly ROUTE_TITLES: Record<string, string> = {
        dashboard: 'Dashboard',
        projects: 'Projects',
        blogs: 'Blog Posts',
        inquiries: 'Inquiries',
        feedback: 'Feedback',
        comments: 'Comments',
        chat: 'Live Chat',
        email: 'Email',
        push: 'Push Notifications',
        'notification-logs': 'Notification Logs',
        invoices: 'Invoices',
        gallery: 'Gallery',
    };

    private setTitleFromUrl(url: string): void {
        const segment = url.split('/').filter(Boolean)[1] ?? '';
        const label = AdminLayoutComponent.ROUTE_TITLES[segment];
        if (label) {
            this.titleService.setTitle(`${label} | Admin`);
        }
    }

    ngOnInit() {
        this.notif.init();
        this.chat.connectAsAdmin();
        this.realtime.connect().then(() => this.realtime.joinAdmin());
        // Load settings first, then start inactivity (so timeout is correct)
        this.adminSettings.load();
        let settingsReady = false;
        this.waitForSettingsInterval = setInterval(() => {
            if (this.adminSettings.loaded()) {
                this.clearWaitForSettings();
                settingsReady = true;
                this.inactivity.start();
            }
        }, 50);
        // Fallback: start after 2s only if settings never loaded (e.g. network error)
        this.waitForSettingsTimeout = setTimeout(() => {
            this.clearWaitForSettings();
            if (!settingsReady) this.inactivity.start();
        }, 2000);
        this.subs.add(
            this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                .subscribe((e) => {
                    this.setTitleFromUrl((e as NavigationEnd).urlAfterRedirects);
                    this.menuOpen.set(false);
                    this.scrollActiveIntoView();
                })
        );
        // Track visitor current pages and activity for linking to chat sessions
        this.subs.add(
            this.realtime.on<{ sessionId: string; path: string; timestamp: string }>('visitor:page_view')
                .subscribe(({ sessionId, path, timestamp }) => this.chat.updateCurrentPage(sessionId, path, timestamp))
        );
        this.subs.add(
            this.realtime.on<{ sessionId: string; eventName: string; path: string | null; timestamp: string }>('visitor:event')
                .subscribe(({ sessionId, eventName, path, timestamp }) => this.chat.logVisitorEvent(sessionId, eventName, path, timestamp))
        );
        this.subs.add(
            this.realtime.on<{ sessionId: string }>('visitor:left')
                .subscribe(({ sessionId }) => this.chat.clearCurrentPage(sessionId))
        );
        // Set title for the initial load
        this.setTitleFromUrl(this.router.url);
    }

    private scrollActiveIntoView(): void {
        setTimeout(() => {
            const active = this.sidebarNav?.nativeElement?.querySelector<HTMLElement>('.is-active');
            active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 50);
    }

    ngAfterViewInit() {
        this.scrollActiveIntoView();
    }

    private clearWaitForSettings(): void {
        if (this.waitForSettingsInterval !== null) {
            clearInterval(this.waitForSettingsInterval);
            this.waitForSettingsInterval = null;
        }
        if (this.waitForSettingsTimeout !== null) {
            clearTimeout(this.waitForSettingsTimeout);
            this.waitForSettingsTimeout = null;
        }
    }

    ngOnDestroy() {
        this.clearWaitForSettings();
        this.notif.disconnect();
        this.chat.disconnectAdmin();
        this.realtime.disconnect();
        this.inactivity.stop();
        this.subs.unsubscribe();
    }

    toggleMenu() { this.menuOpen.update(v => !v); }
    closeMenu() { this.menuOpen.set(false); }
    logout() { this.auth.logout().subscribe(); }
}
