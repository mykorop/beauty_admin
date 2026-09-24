import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CardScope } from '../../shared/profile-card/card-scope';
import type {
  CatalogService,
  CatalogServiceFields,
  CatalogServicePatch,
} from '../../shared/service-catalog/service-catalog.model';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';
import { withReason } from './reason-body';
import { EDIT_CONFLICT_CODE } from './api-error';

const servicesUrl = (scope: CardScope, serviceId?: string): string =>
  adminApiUrl(`${scope.base}/services${serviceId ? `/${encodeURIComponent(serviceId)}` : ''}`);

/**
 * The Каталог послуг of a Салон or of a Незалежний майстер — the same calls at the profile's own
 * path. Nothing here reaches a Копія майстра, by design of the domain: a Салон's service answers
 * how many Майстри hold one of it, and that is all.
 */
@Injectable({ providedIn: 'root' })
export class ServiceCatalogClient {
  private readonly http = inject(HttpClient);

  /** A caller that knows whose Каталог it reads may name its services' shape: a Салон's `SalonService`. */
  list<S extends CatalogService = CatalogService>(scope: CardScope): Observable<{ items: S[] }> {
    return this.http.get<{ items: S[] }>(servicesUrl(scope));
  }

  get(scope: CardScope, serviceId: string): Observable<CatalogService> {
    return this.http.get<CatalogService>(servicesUrl(scope, serviceId));
  }

  create(
    scope: CardScope,
    request: { fields: CatalogServiceFields; reason?: string },
  ): Observable<CatalogService> {
    return this.http.post<CatalogService>(servicesUrl(scope), {
      ...request.fields,
      ...withReason(request.reason),
    });
  }

  /** `EDIT_CONFLICT` is the form's own message, so it is left to the caller. */
  update(
    scope: CardScope,
    serviceId: string,
    request: { updatedAt: string; patch: CatalogServicePatch; reason?: string },
  ): Observable<CatalogService> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<CatalogService>(
      servicesUrl(scope, serviceId),
      { updatedAt, ...patch, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }

  /** Deactivation, never a deletion; `update` with `isActive: true` brings the service back. */
  deactivate(scope: CardScope, serviceId: string): Observable<CatalogService> {
    return this.http.delete<CatalogService>(servicesUrl(scope, serviceId));
  }
}
