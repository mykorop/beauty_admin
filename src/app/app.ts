import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <p-toast
      position="top-right"
      data-testid="toast"
      [pt]="{ closeButton: { autofocus: false } }"
    />
    <router-outlet />
  `,
})
export class App {
  constructor() {
    const document = inject(DOCUMENT);
    const router = inject(Router);
    // Temporary scopes until ticket 05: later tabs keep their light content and overlays,
    // while every profile frame uses BookMe. No OS/theme preference changes these routes.
    const syncTheme = (url: string) => {
      const path = url.split(/[?;#]/)[0];
      const profiles = /^\/(salons|independent-masters|clients)(\/|$)/.test(path);
      const migrated =
        /^\/(salons|independent-masters|clients)(\/[^/]+(\/masters\/[^/]+)?(\/(profile|services|roster|invites|hours|schedule|appointments))?)?\/?$/.test(
          path,
        );
      document.documentElement.classList.toggle('bookme-profile', profiles);
      document.documentElement.classList.toggle(
        'bookme-dark',
        /^\/(login|dashboard|appointments)$/.test(path) || migrated,
      );
    };
    syncTheme(router.url);
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) syncTheme(event.urlAfterRedirects);
    });
  }
}
