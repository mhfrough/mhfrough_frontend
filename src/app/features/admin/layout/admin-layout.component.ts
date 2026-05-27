import { Component, OnInit, OnDestroy, inject, signal, HostBinding } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';
import { ChatService } from '../../../core/services/chat.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { InactivityService } from '../../../core/services/inactivity.service';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    @HostBinding('attr.data-bs-theme') readonly darkTheme = 'dark';
    readonly auth = inject(AuthService);
    readonly notif = inject(AdminNotificationService);
    readonly chat = inject(ChatService);
    readonly inactivity = inject(InactivityService);
    private readonly router = inject(Router);
    private readonly realtime = inject(RealtimeService);
    readonly menuOpen = signal(false);
    private subs = new Subscription();

    ngOnInit() {
        this.notif.init();
        this.chat.connectAsAdmin();
        this.realtime.connect().then(() => this.realtime.joinAdmin());
        this.inactivity.start();
        this.subs.add(
            this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                .subscribe(() => this.menuOpen.set(false))
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
