import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';

export type SalonStatus = 'active' | 'blocked' | 'deleted';

/** PrimeNG tag severity of each state — the list and the card mark a Салон the same way. */
export const SALON_STATUS_SEVERITY: Record<SalonStatus, 'success' | 'warn' | 'danger'> = {
  active: 'success',
  blocked: 'warn',
  deleted: 'danger',
};

export type SalonListItem = {
  salonId: string;
  name: string;
  city: string;
  cityCode: string;
  /** Власник салону; empty on salons registered before owners gave their name. */
  ownerName: string;
  email: string;
  phone: string;
  rating: number;
  reviewCount: number;
  status: SalonStatus;
  createdAt: string;
};

export type SalonList = {
  items: SalonListItem[];
  /** When `admin-api` built the list from the table — it is cached for a few minutes. */
  builtAt: string;
};

export type ShortLink = { kind: 'random' | 'handle'; code: string; path: string };

/** The whole profile of one Салон, Deleted ones included. */
export type Salon = {
  salonId: string;
  name: string;
  ownerName: string;
  description: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressCityCode: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  addressCountry: string;
  locationLatitude: string | null;
  locationLongitude: string | null;
  phone: string;
  email: string;
  /** Always a usable IANA zone — every date of the card is shown in it, not in the browser's. */
  timezone: string;
  rating: number;
  reviewCount: number;
  bufferMinutes: number;
  bookingForwardDays: number;
  brandColor: string | null;
  language: string | null;
  status: SalonStatus;
  deletedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  shortLinks: { random: ShortLink | null; handle: ShortLink | null };
  createdAt: string;
  updatedAt: string;
};

export type SalonDayHours = {
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  isOpen: boolean;
  slots: { start: string; end: string }[];
};

export type SalonHours = {
  /** Only the days the salon has set. */
  days: SalonDayHours[];
};

@Injectable({ providedIn: 'root' })
export class SalonsClient {
  private readonly http = inject(HttpClient);

  /** The whole platform in one response; `refresh` makes the backend rebuild its cached list. */
  list(options: { refresh?: boolean } = {}): Observable<SalonList> {
    return this.http.get<SalonList>(adminApiUrl('/admin/salons'), {
      params: options.refresh ? { refresh: 'true' } : {},
    });
  }

  /** A missing salon is the card's own screen, not a toast: `NOT_FOUND` is left to the caller. */
  get(salonId: string): Observable<Salon> {
    return this.http.get<Salon>(adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}`), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }

  hours(salonId: string): Observable<SalonHours> {
    return this.http.get<SalonHours>(adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/hours`));
  }
}
