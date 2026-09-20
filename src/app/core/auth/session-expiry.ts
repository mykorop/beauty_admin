import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export const LOGIN_PATH = '/login';

/** Whether `url` is the login screen itself — and not merely a path that begins the same way. */
export function isLoginUrl(url: string): boolean {
  return /^\/login(?:[/?#]|$)/.test(url);
}

/**
 * What happens when the session cannot be renewed any more: sign out and show the login screen,
 * remembering the address so that signing in again lands on the same page.
 */
@Injectable({ providedIn: 'root' })
export class SessionExpiry {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Shared, so a burst of refused requests produces one sign-out and one navigation.
  private inFlight: Promise<void> | null = null;

  expire(): Promise<void> {
    this.inFlight ??= this.signOutAndRedirect().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  private async signOutAndRedirect(): Promise<void> {
    // Mid-navigation (a guard's request was refused) the address to come back to is the one being
    // navigated to; `router.url` is still the page being left.
    const navigation = this.router.getCurrentNavigation();
    const returnUrl = navigation ? this.router.serializeUrl(navigation.extractedUrl) : this.router.url;
    await this.auth.signOut();

    if (isLoginUrl(returnUrl)) {
      return;
    }
    await this.router.navigate([LOGIN_PATH], { queryParams: { returnUrl, reason: 'sessionExpired' } });
  }
}
