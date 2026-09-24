import { environment } from '../../../environments/environment';

/** A path of `admin-api`, ids already encoded — e.g. `/admin/salons/s1/media`. */
export type AdminPath = `/admin/${string}`;

/** Absolute URL of an `admin-api` path, e.g. `adminApiUrl('/admin/me')`. */
export function adminApiUrl(path: AdminPath): string {
  return `${environment.adminApiUrl}${path}`;
}

/** Where a Салон lives in `admin-api`: everything of it — and of its Ростер — is beneath. */
export const salonPath = (salonId: string): AdminPath =>
  `/admin/salons/${encodeURIComponent(salonId)}`;

/** Where a Незалежний майстер lives in `admin-api`. */
export const masterPath = (masterId: string): AdminPath =>
  `/admin/masters/${encodeURIComponent(masterId)}`;

/** Where a Клієнт lives in `admin-api`. */
export const clientPath = (clientId: string): AdminPath =>
  `/admin/clients/${encodeURIComponent(clientId)}`;
