import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { adminApiInterceptor } from './core/api/admin-api.interceptor';
import { BookMePreset } from './theme/bookme-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([adminApiInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: BookMePreset,
        options: {
          darkModeSelector: '.bookme-dark',
          cssLayer: { name: 'primeng', order: 'theme, base, primeng, components, utilities' },
        },
      },
    }),
    // One app-wide instance: the interceptor adds to it, the root `<p-toast>` renders it.
    MessageService,
  ],
};
