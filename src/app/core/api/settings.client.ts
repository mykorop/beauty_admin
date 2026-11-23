import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';
import { withReason } from './reason-body';

/**
 * The settings of the platform itself rather than of any Салон or Майстер. The backend keeps them
 * in its table, which dev and staging share and every prod stack shares, so one set of them governs
 * dev and staging together and another every prod stack.
 */
export type PlatformSettings = {
  /** Whether +380 is offered to new numbers, and codes and SMS about Записи reach Ukrainian mobiles. */
  ukrainianPhonesEnabled: boolean;
  /** When an Адміністратор платформи last changed them; `null` while nobody ever has. */
  updatedAt: string | null;
};

@Injectable({ providedIn: 'root' })
export class PlatformSettingsClient {
  private readonly http = inject(HttpClient);

  get(): Observable<PlatformSettings> {
    return this.http.get<PlatformSettings>(adminApiUrl('/admin/settings'));
  }

  /**
   * «Українські номери (+380)» set to `enabled` — the whole state, not a toggle — with the optional
   * reason the Журнал records. Answers with the settings as they now are.
   */
  setUkrainianPhones(request: { enabled: boolean; reason?: string }): Observable<PlatformSettings> {
    const { enabled, reason } = request;
    return this.http.put<PlatformSettings>(adminApiUrl('/admin/settings/ukrainian-phones'), {
      enabled,
      ...withReason(reason),
    });
  }
}
