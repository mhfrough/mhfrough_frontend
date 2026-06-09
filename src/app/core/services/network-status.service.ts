import { Injectable, signal, PLATFORM_ID, inject, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService implements OnDestroy {
    private readonly platformId = inject(PLATFORM_ID);

    readonly isOnline = signal(
        isPlatformBrowser(this.platformId) ? navigator.onLine : true,
    );

    readonly online$ = toObservable(this.isOnline).pipe(filter(Boolean));

    private readonly onOnline = () => this.isOnline.set(true);
    private readonly onOffline = () => this.isOnline.set(false);

    constructor() {
        if (!isPlatformBrowser(this.platformId)) return;
        window.addEventListener('online', this.onOnline);
        window.addEventListener('offline', this.onOffline);
    }

    ngOnDestroy() {
        if (!isPlatformBrowser(this.platformId)) return;
        window.removeEventListener('online', this.onOnline);
        window.removeEventListener('offline', this.onOffline);
    }
}
