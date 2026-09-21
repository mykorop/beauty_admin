import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { EDIT_CONFLICT_CODE } from './api-error';
import { adminApiUrl } from './admin-api-url';

/** One послуга of a Каталог послуг as the table and the form read it. */
export type SalonService = {
  serviceId: string;
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  /** The stored price as typed — per hour when `priceUnit` is `PER_HOUR`. */
  price: number;
  currency: string;
  priceUnit: string;
  isActive: boolean;
  /** Майстри on the Ростер holding a Копія майстра of this service. */
  masterCopyCount: number;
  createdAt: string;
  /** Goes back as-is with a PATCH. */
  updatedAt: string;
};

/** What the administrator may change on a service of the Каталог. */
export type SalonServiceFields = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
};

/** Only the fields that changed, never the whole form. */
export type SalonServicePatch = Partial<SalonServiceFields>;

/** Платформні довідники — stored labels, read-only; the panel translates them. */
export type Dictionaries = {
  serviceCategories: string[];
  specializations: string[];
  /** What a new service may be priced in — MDL only, as for the business itself. */
  serviceCurrencies: string[];
};

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

@Injectable({ providedIn: 'root' })
export class DictionariesClient {
  private readonly http = inject(HttpClient);
  private cached: Observable<Dictionaries> | null = null;

  /** Fixed platform lists: read once per session; a failed read is not remembered. */
  get(): Observable<Dictionaries> {
    return (this.cached ??= this.http
      .get<Dictionaries>(adminApiUrl('/admin/dictionaries'))
      .pipe(shareReplay({ bufferSize: 1, refCount: false })));
  }
}
