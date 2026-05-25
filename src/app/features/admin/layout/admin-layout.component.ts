import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { AdminNotificationService } from '../../../core/services/admin-notification.service';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
    readonly auth = inject(AuthService);
    readonly notif = inject(AdminNotificationService);
    private readonly router = inject(Router);
    readonly menuOpen = signal(false);
    private subs = new Subscription();

    ngOnInit() {
        this.notif.init();
        this.subs.add(
            this.router.events.pipe(filter(e => e instanceof NavigationEnd))
                .subscribe(() => this.menuOpen.set(false))
        );
    }

    ngOnDestroy() {
        this.notif.disconnect();
        this.subs.unsubscribe();
    }

    toggleMenu() { this.menuOpen.update(v => !v); }
    closeMenu() { this.menuOpen.set(false); }
    logout() { this.auth.logout().subscribe(); }
}
