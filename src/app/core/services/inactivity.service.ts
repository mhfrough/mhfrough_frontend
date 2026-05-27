import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { AdminSettingsService } from './admin-settings.service';

const DEFAULT_TIMEOUT_MINUTES = 10;
const COUNTDOWN_SECS = 60;

@Injectable({ providedIn: 'root' })
export class InactivityService {
    readonly showWarning = signal(false);
    readonly countdown = signal(COUNTDOWN_SECS);

    private readonly auth = inject(AuthService);
    private readonly settingsService = inject(AdminSettingsService);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly zone = inject(NgZone);

    private warningTimer: ReturnType<typeof setTimeout> | null = null;
    private logoutTimer: ReturnType<typeof setTimeout> | null = null;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private readonly events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    private boundReset: () => void;

    constructor() {
        this.boundReset = () => this.reset();
    }

    start() {
        if (!isPlatformBrowser(this.platformId)) return;
        const settings = this.settingsService.settings();
        // Skip inactivity logout if disabled or user chose Remember Me
        if (!settings.enableInactivityLogout || this.auth.isRememberMe()) return;
        this.events.forEach(e => window.addEventListener(e, this.boundReset, { passive: true }));
        this.scheduleWarning();
    }

    stop() {
        if (!isPlatformBrowser(this.platformId)) return;
        this.events.forEach(e => window.removeEventListener(e, this.boundReset));
        this.clearTimers();
        this.showWarning.set(false);
    }

    stayLoggedIn() {
        this.showWarning.set(false);
        this.clearTimers();
        this.scheduleWarning();
    }

    private get timeoutMinutes(): number {
        const s = this.settingsService.settings();
        return s.inactivityTimeoutMinutes > 0 ? s.inactivityTimeoutMinutes : DEFAULT_TIMEOUT_MINUTES;
    }

    private get warningMs(): number {
        const total = this.timeoutMinutes * 60 * 1000;
        return Math.max(total - COUNTDOWN_SECS * 1000, 0);
    }

    private reset() {
        if (this.showWarning()) return;
        this.clearTimers();
        this.scheduleWarning();
    }

    private scheduleWarning() {
        this.warningTimer = setTimeout(() => {
            this.zone.run(() => {
                this.showWarning.set(true);
                this.countdown.set(COUNTDOWN_SECS);
                this.startCountdown();
            });
        }, this.warningMs);
    }

    private startCountdown() {
        this.countdownInterval = setInterval(() => {
            this.zone.run(() => {
                const next = this.countdown() - 1;
                this.countdown.set(next);
                if (next <= 0) {
                    this.clearTimers();
                    this.showWarning.set(false);
                    this.auth.forceLogout();
                }
            });
        }, 1000);
    }

    private clearTimers() {
        if (this.warningTimer !== null) { clearTimeout(this.warningTimer); this.warningTimer = null; }
        if (this.logoutTimer !== null) { clearTimeout(this.logoutTimer); this.logoutTimer = null; }
        if (this.countdownInterval !== null) { clearInterval(this.countdownInterval); this.countdownInterval = null; }
    }
}
