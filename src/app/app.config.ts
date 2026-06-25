import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, APP_INITIALIZER, PLATFORM_ID, inject, ErrorHandler } from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { isPlatformBrowser, IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorLogInterceptor } from './core/interceptors/error-log.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';
import { SyncQueueService } from './core/services/sync-queue.service';
import { environment } from '../environments/environment';

function warmUpBackend() {
  const platformId = inject(PLATFORM_ID);
  return () => {
    if (!isPlatformBrowser(platformId)) return;
    // The backend runs on a free Render dyno that sleeps after ~15 min idle and
    // takes ~50s to cold start. Fire a non-blocking ping at boot so it wakes
    // while the user reads cached content — by the time they navigate, the
    // first real request usually isn't waiting on the spin-up. GET /api/v1 is a
    // tiny public endpoint; failures are ignored.
    fetch(environment.apiUrl, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' }).catch(() => { });
  };
}

function registerFirebaseSW() {
  const platformId = inject(PLATFORM_ID);
  return () => {
    if (!isPlatformBrowser(platformId) || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => {
      // Non-critical — FCM background messaging won't work but app continues
    });
  };
}

function initSyncQueue() {
  const syncQueue = inject(SyncQueueService);
  const platformId = inject(PLATFORM_ID);
  return async () => {
    if (!isPlatformBrowser(platformId)) return;
    await syncQueue.init();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor, authInterceptor, errorLogInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: APP_INITIALIZER, useFactory: registerFirebaseSW, multi: true },
    { provide: APP_INITIALIZER, useFactory: warmUpBackend, multi: true },
    { provide: APP_INITIALIZER, useFactory: initSyncQueue, multi: true },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: IMAGE_LOADER, useValue: (config: ImageLoaderConfig) => config.src },
  ],
};
