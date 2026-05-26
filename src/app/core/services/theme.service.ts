import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private readonly platformId = inject(PLATFORM_ID);

    init() {
        if (!isPlatformBrowser(this.platformId)) return;
        document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
}
