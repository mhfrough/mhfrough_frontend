import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NetworkStatusService } from '../../core/services/network-status.service';

const STORAGE_KEY = 'cookie_consent';

@Component({
    selector: 'app-cookie-consent',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './cookie-consent.component.html',
    styleUrl: './cookie-consent.component.scss',
})
export class CookieConsentComponent implements OnInit, OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);
    protected readonly network = inject(NetworkStatusService);
    readonly visible = signal(false);
    private timer: ReturnType<typeof setTimeout> | null = null;

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) return;
        if (localStorage.getItem(STORAGE_KEY)) return;
        this.timer = setTimeout(() => this.visible.set(true), 10000);
    }

    ngOnDestroy() {
        if (this.timer !== null) clearTimeout(this.timer);
    }

    accept() {
        localStorage.setItem(STORAGE_KEY, 'accepted');
        this.visible.set(false);
    }

    decline() {
        localStorage.setItem(STORAGE_KEY, 'declined');
        this.visible.set(false);
    }
}
