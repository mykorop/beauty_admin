import { environment } from '../../../environments/environment';

/** Absolute URL of an `admin-api` path, e.g. `adminApiUrl('/admin/me')`. */
export function adminApiUrl(path: `/admin/${string}`): string {
  return `${environment.adminApiUrl}${path}`;
}
