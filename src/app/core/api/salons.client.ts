import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { HOURS_REFUSAL_CODES } from './api-error';
import type { DayHours } from './master-schedule.model';
import { adminApiUrl, salonPath } from './admin-api-url';
import { withAllowedAppointments } from './allow-existing-appointments';
import { withReason } from './reason-body';

export type SalonStatus = 'active' | 'blocked' | 'deleted';

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

export type SalonDayHours = DayHours;

export type SalonHours = {
  /** Only the days the salon has set. */
  days: SalonDayHours[];
};

/** What the administrator may change on a Салон; the account's email, phone and password are not here. */
export type SalonProfileFields = {
  name: string;
  description: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressCityCode: string;
  addressZipCode: string;
  phone: string;
  bufferMinutes: number;
  bookingForwardDays: number;
  brandColor: string | null;
};

/** Only the fields that changed, never the whole form. */
export type SalonProfilePatch = Partial<SalonProfileFields>;

const salonUrl = (salonId: string, rest = ''): string =>
  adminApiUrl(`${salonPath(salonId)}${rest && `/${rest}`}`);

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
    return this.http.get<Salon>(salonUrl(salonId), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }

  hours(salonId: string): Observable<SalonHours> {
    return this.http.get<SalonHours>(salonUrl(salonId, 'hours'));
  }

  /**
   * The whole resulting week, all seven days. A week the domain refuses is worded by the form
   * itself — rule by rule, master by master, and the Записи of the whole Ростер it would leave
   * standing — so those codes are left to the caller.
   */
  updateHours(
    salonId: string,
    request: { days: SalonDayHours[]; reason?: string; allowExistingAppointments?: boolean },
  ): Observable<SalonHours> {
    const { days, reason, allowExistingAppointments } = request;
    return this.http.put<SalonHours>(
      salonUrl(salonId, 'hours'),
      {
        salonHours: days,
        ...withReason(reason),
        ...withAllowedAppointments(allowExistingAppointments),
      },
      { context: new HttpContext().set(SILENT_ERROR_CODES, HOURS_REFUSAL_CODES) },
    );
  }
}
