import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, APP_INITIALIZER, PLATFORM_ID, inject, ErrorHandler } from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { isPlatformBrowser, IMAGE_LOADER, ImageLoaderConfig } from '@angular/common';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorLogInterceptor } from './core/interceptors/error-log.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';

function registerFirebaseSW() {
  const platformId = inject(PLATFORM_ID);
  return () => {
    if (!isPlatformBrowser(platformId) || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }).catch(() => {
      // Non-critical — FCM background messaging won't work but app continues
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideRouter(routes, withViewTransitions(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([credentialsInterceptor, authInterceptor, errorLogInterceptor])),
    provideClientHydration(withEventReplay()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    { provide: APP_INITIALIZER, useFactory: registerFirebaseSW, multi: true },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: IMAGE_LOADER, useValue: (config: ImageLoaderConfig) => config.src },
  ],
};
