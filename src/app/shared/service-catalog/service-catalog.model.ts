import type { Observable } from 'rxjs';

/**
 * One послуга of a Каталог послуг as the table and the form read it — the Салон's (`/admin/salons/…`)
 * or a Незалежний майстер's own (`/admin/masters/…`). The two answers differ in exactly one field,
 * and this is it: a Салон's service says how many Майстри hold a Копія майстра of it, a Незалежний
 * майстер's cannot, because there is no Ростер under his Каталог.
 */
export type CatalogService = {
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
  /** Майстри on the Ростер holding a Копія майстра of this service; absent for a Незалежний майстер. */
  masterCopyCount?: number;
  createdAt: string;
  /** Goes back as-is with a PATCH. */
  updatedAt: string;
};

/** What the administrator may change on a service of a Каталог. */
export type CatalogServiceFields = {
  name: string;
  description: string;
  category: string;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
};

/** Only the fields that changed, never the whole form. */
export type CatalogServicePatch = Partial<CatalogServiceFields>;

/**
 * The four calls a Каталог editor makes, bound to whose Каталог it is. The table and the form take
 * one of these instead of a client and an id, so neither of them knows whether it is editing a
 * Салон or a Незалежний майстер — which is what lets one editor serve both cards.
 */
export type ServiceCatalogPort = {
  list(): Observable<{ items: CatalogService[] }>;
  get(serviceId: string): Observable<CatalogService>;
  create(request: { fields: CatalogServiceFields; reason?: string }): Observable<CatalogService>;
  update(
    serviceId: string,
    request: { updatedAt: string; patch: CatalogServicePatch; reason?: string },
  ): Observable<CatalogService>;
  /** Deactivation, never a deletion; `update` with `isActive: true` brings the service back. */
  deactivate(serviceId: string): Observable<CatalogService>;
};
