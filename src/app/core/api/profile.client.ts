import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CardScope } from '../../shared/profile-card/card-scope';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl, type AdminPath } from './admin-api-url';
import { withReason } from './reason-body';
import { EDIT_CONFLICT_CODE } from './api-error';

/**
 * A profile as a whole — whichever kind, at its own path: its Блокування and the edit of its
 * Профіль. Every answer is the whole profile, which the card then shows.
 */
@Injectable({ providedIn: 'root' })
export class ProfileClient {
  private readonly http = inject(HttpClient);

  /**
   * Блокування, and its lifting — both heavy actions, so both carry a mandatory reason. The refusals
   * they can earn (a Видалений profile, a Майстер on a Ростер, the repeat codes) are ordinary toasts.
   */
  block<P>(scope: CardScope, reason: string): Observable<P> {
    return this.http.post<P>(adminApiUrl(`${scope.base}/block`), { reason });
  }

  unblock<P>(scope: CardScope, reason: string): Observable<P> {
    return this.http.post<P>(adminApiUrl(`${scope.base}/unblock`), { reason });
  }

  /**
   * Only the fields that changed, under the `updatedAt` the administrator saw (`null` for a link
   * nobody has edited yet): if the owner saved since, the backend refuses with `EDIT_CONFLICT` —
   * the form's own message, so it is left to the caller.
   */
  update<P>(
    path: AdminPath,
    request: { updatedAt: string | null; patch: object; reason?: string },
  ): Observable<P> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<P>(
      adminApiUrl(path),
      { updatedAt, ...patch, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }
}
