import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_MS = 9 * 60 * 1000;     // show warning at 9 minutes (1 min before logout)
const COUNTDOWN_SECS = 60;

@Injectable({ providedIn: 'root' })
export class InactivityService {
    readonly showWarning = signal(false);
    readonly countdown = signal(COUNTDOWN_SECS);

    private readonly auth = inject(AuthService);
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
        }, WARNING_MS);
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
