import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly platformId = inject(PLATFORM_ID);
    readonly isDark = signal<boolean>(false);
    readonly autoSwitch = signal<boolean>(true);

    init() {
        if (!isPlatformBrowser(this.platformId)) return;
        const autoSaved = localStorage.getItem('theme-auto');
        const isAuto = autoSaved === null ? true : autoSaved === 'true';
        this.autoSwitch.set(isAuto);

        if (isAuto) {
            this.applyTimeBasedTheme();
        } else {
            const saved = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setDark(saved ? saved === 'dark' : prefersDark);
        }

        // Re-check every minute for time-based auto switch
        setInterval(() => {
            if (this.autoSwitch()) this.applyTimeBasedTheme();
        }, 60_000);
    }

    /** Manual toggle — disables auto-switch */
    toggle() {
        this.autoSwitch.set(false);
        localStorage.setItem('theme-auto', 'false');
        const next = !this.isDark();
        this.setDark(next);
        localStorage.setItem('theme', next ? 'dark' : 'light');
    }

    toggleAutoSwitch() {
        const next = !this.autoSwitch();
        this.autoSwitch.set(next);
        localStorage.setItem('theme-auto', String(next));
        if (next) this.applyTimeBasedTheme();
    }

    private applyTimeBasedTheme() {
        const h = new Date().getHours();
        // Dark after 7 pm (19:00) or before 6 am
        this.setDark(h >= 19 || h < 6);
    }

    private setDark(dark: boolean) {
        this.isDark.set(dark);
        if (isPlatformBrowser(this.platformId)) {
            document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
        }
    }
}
