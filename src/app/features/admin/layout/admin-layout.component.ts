import { Component, OnInit, OnDestroy, inject, signal, HostBinding, ViewChild, ElementRef } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
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
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    @ViewChild('sidebarNav') sidebarNav?: ElementRef<HTMLUListElement>;
    readonly auth = inject(AuthService);
    readonly notif = inject(AdminNotificationService);
    readonly chat = inject(ChatService);
    readonly inactivity = inject(InactivityService);
    readonly adminSettings = inject(AdminSettingsService);
    private readonly router = inject(Router);
    private readonly realtime = inject(RealtimeService);
    readonly menuOpen = signal(false);
    private subs = new Subscription();

    ngOnInit() {
        this.notif.init();
        this.chat.connectAsAdmin();
        this.realtime.connect().then(() => this.realtime.joinAdmin());
        // Load settings first, then start inactivity (so timeout is correct)
        this.adminSettings.load();
        const waitForSettings = setInterval(() => {
            if (this.adminSettings.loaded()) {
                clearInterval(waitForSettings);
                this.inactivity.start();
            }
        }, 50);
        // Fallback: start after 2s even if settings failed
        setTimeout(() => { clearInterval(waitForSettings); if (!this.inactivity.showWarning()) this.inactivity.start(); }, 2000);
        this.subs.add(
            this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                .subscribe(() => {
                    this.menuOpen.set(false);
                    setTimeout(() => {
                        const active = this.sidebarNav?.nativeElement?.querySelector<HTMLElement>('.is-active');
                        active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 50);
                })
        );
    }

    ngOnDestroy() {
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
