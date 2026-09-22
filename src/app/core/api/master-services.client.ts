import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  CatalogService,
  CatalogServiceFields,
  CatalogServicePatch,
} from '../../shared/service-catalog/service-catalog.model';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';
import { EDIT_CONFLICT_CODE } from './api-error';

/**
 * One послуга of a Незалежний майстер's own Каталог: the shared catalog service without
 * `masterCopyCount` — there is no Ростер under his Каталог, so no Копії майстра to count.
 */
export type MasterCatalogService = Omit<CatalogService, 'masterCopyCount'>;

const servicesUrl = (masterId: string, serviceId?: string): string =>
  adminApiUrl(
    `/admin/masters/${encodeURIComponent(masterId)}/services${serviceId ? `/${encodeURIComponent(serviceId)}` : ''}`,
  );

const withReason = (reason: string | undefined) => (reason ? { reason } : {});

/**
 * The Каталог послуг of a Незалежний майстер — the same calls as a Салон's, on his own path. What
 * is stored here is what the Клієнт books: no Копія майстра stands between the two.
 */
@Injectable({ providedIn: 'root' })
export class MasterServicesClient {
  private readonly http = inject(HttpClient);

  catalog(masterId: string): Observable<{ items: MasterCatalogService[] }> {
    return this.http.get<{ items: MasterCatalogService[] }>(servicesUrl(masterId));
  }

  get(masterId: string, serviceId: string): Observable<MasterCatalogService> {
    return this.http.get<MasterCatalogService>(servicesUrl(masterId, serviceId));
  }

  create(
    masterId: string,
    request: { fields: CatalogServiceFields; reason?: string },
  ): Observable<MasterCatalogService> {
    return this.http.post<MasterCatalogService>(servicesUrl(masterId), {
      ...request.fields,
      ...withReason(request.reason),
    });
  }

  /** `EDIT_CONFLICT` is the form's own message, so it is left to the caller. */
  update(
    masterId: string,
    serviceId: string,
    request: { updatedAt: string; patch: CatalogServicePatch; reason?: string },
  ): Observable<MasterCatalogService> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<MasterCatalogService>(
      servicesUrl(masterId, serviceId),
      { updatedAt, ...patch, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }

  /** Deactivation, never a deletion; `update` with `isActive: true` brings the service back. */
  deactivate(masterId: string, serviceId: string): Observable<MasterCatalogService> {
    return this.http.delete<MasterCatalogService>(servicesUrl(masterId, serviceId));
  }
}
