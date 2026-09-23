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
    <p-toast position="top-right" data-testid="toast" />
    <router-outlet />
  `,
})
export class App {
  constructor() {
    const document = inject(DOCUMENT);
    const router = inject(Router);
    // Temporary route scope until ticket 05: legacy pages AND their body-mounted overlays stay
    // light. Shell chrome carries its own dark scope on every route. No OS/theme preference.
    const syncTheme = (url: string) =>
      document.documentElement.classList.toggle(
        'bookme-dark',
        /^\/(login|dashboard)([?;#]|$)/.test(url),
      );
    syncTheme(router.url);
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) syncTheme(event.urlAfterRedirects);
    });
  }
}
