import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { EDIT_CONFLICT_CODE } from './api-error';
import { adminApiUrl } from './admin-api-url';
import type {
  CatalogService,
  CatalogServiceFields,
  CatalogServicePatch,
} from '../../shared/service-catalog/service-catalog.model';

/**
 * One послуга of the Каталог послуг of a Салон: the shared catalog service, which always knows how
 * many Майстри hold a Копія майстра of it — only a Салон has a Ростер under its Каталог.
 */
export type SalonService = CatalogService & { masterCopyCount: number };

/** What the administrator may change on a service of the Каталог. */
export type SalonServiceFields = CatalogServiceFields;

/** Only the fields that changed, never the whole form. */
export type SalonServicePatch = CatalogServicePatch;

const servicesUrl = (salonId: string, serviceId?: string): string =>
  adminApiUrl(
    `/admin/salons/${encodeURIComponent(salonId)}/services${serviceId ? `/${encodeURIComponent(serviceId)}` : ''}`,
  );

const withReason = (reason: string | undefined) => (reason ? { reason } : {});

/** The Каталог послуг of a Салон. Nothing here reaches a Копія майстра — by design of the domain. */
@Injectable({ providedIn: 'root' })
export class SalonServicesClient {
  private readonly http = inject(HttpClient);

  catalog(salonId: string): Observable<{ items: SalonService[] }> {
    return this.http.get<{ items: SalonService[] }>(servicesUrl(salonId));
  }

  get(salonId: string, serviceId: string): Observable<SalonService> {
    return this.http.get<SalonService>(servicesUrl(salonId, serviceId));
  }

  create(salonId: string, request: { fields: SalonServiceFields; reason?: string }): Observable<SalonService> {
    return this.http.post<SalonService>(servicesUrl(salonId), {
      ...request.fields,
      ...withReason(request.reason),
    });
  }

  /** `EDIT_CONFLICT` is the form's own message, so it is left to the caller. */
  update(
    salonId: string,
    serviceId: string,
    request: { updatedAt: string; patch: SalonServicePatch; reason?: string },
  ): Observable<SalonService> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<SalonService>(
      servicesUrl(salonId, serviceId),
      { updatedAt, ...patch, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }

  /** Deactivation, never a deletion; `update` with `isActive: true` brings the service back. */
  deactivate(salonId: string, serviceId: string): Observable<SalonService> {
    return this.http.delete<SalonService>(servicesUrl(salonId, serviceId));
  }
}
