import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { EDIT_CONFLICT_CODE } from './api-error';
import { adminApiUrl } from './admin-api-url';
import { withReason } from './reason-body';

/** One Копія майстра as the table and the form read it. */
export type MasterService = {
  serviceId: string;
  name: string;
  description: string;
  category: string;
  /** The master's own — what the Клієнт sees and books. */
  durationMinutes: number;
  /** The stored price as typed — per hour when `priceUnit` is `PER_HOUR`. */
  price: number;
  currency: string;
  priceUnit: string;
  /** The Копія's own switch; the service is offered only while the Каталог's is on too. */
  isActive: boolean;
  /** What the Каталог holds for the same service; `null` once it holds it no more. */
  catalog: { durationMinutes: number; price: number; isActive: boolean } | null;
  createdAt: string;
  /** Goes back as-is with a PATCH. */
  updatedAt: string;
};

/** What the administrator may change on a Копія — everything else is the Каталог's. */
export type MasterServiceFields = { price: number; durationMinutes: number; isActive: boolean };

/** Only the fields that changed, never the whole form. */
export type MasterServicePatch = Partial<MasterServiceFields>;

const copiesUrl = (salonId: string, masterId: string, serviceId?: string): string =>
  adminApiUrl(
    `/admin/salons/${encodeURIComponent(salonId)}/masters/${encodeURIComponent(masterId)}/services${
      serviceId ? `/${encodeURIComponent(serviceId)}` : ''
    }`,
  );

/** The Копії майстра of one Майстер салону. Nothing here reaches the Каталог послуг. */
@Injectable({ providedIn: 'root' })
export class SalonMasterServicesClient {
  private readonly http = inject(HttpClient);

  list(salonId: string, masterId: string): Observable<{ items: MasterService[] }> {
    return this.http.get<{ items: MasterService[] }>(copiesUrl(salonId, masterId));
  }

  /** A Копія the master already holds comes back as stored — the backend never overwrites one. */
  add(
    salonId: string,
    masterId: string,
    request: { serviceId: string; price: number; durationMinutes: number; reason?: string },
  ): Observable<MasterService> {
    const { reason, ...fields } = request;
    return this.http.post<MasterService>(copiesUrl(salonId, masterId), {
      ...fields,
      ...withReason(reason),
    });
  }

  /** `EDIT_CONFLICT` is the form's own message, so it is left to the caller. */
  update(
    salonId: string,
    masterId: string,
    serviceId: string,
    request: { updatedAt: string; patch: MasterServicePatch; reason?: string },
  ): Observable<MasterService> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<MasterService>(
      copiesUrl(salonId, masterId, serviceId),
      { updatedAt, ...patch, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }

  /** A real removal: the master's own price goes with the row and stays only in the Журнал дій. */
  remove(salonId: string, masterId: string, serviceId: string): Observable<{ removed: true; serviceId: string }> {
    return this.http.delete<{ removed: true; serviceId: string }>(copiesUrl(salonId, masterId, serviceId));
  }
}
