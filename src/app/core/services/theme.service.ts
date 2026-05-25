import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly isDark = signal<boolean>(false);

  init() {
    if (!isPlatformBrowser(this.platformId)) return;
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    this.setDark(dark);
  }

  toggle() { this.setDark(!this.isDark()); }

  private setDark(dark: boolean) {
    this.isDark.set(dark);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }
  }
}
