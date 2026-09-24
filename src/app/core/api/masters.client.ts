import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl, masterPath } from './admin-api-url';
import type { ShortLink } from './salons.client';

/** A Незалежний майстер wears the same three states as a Салон. */
export type MasterStatus = 'active' | 'blocked' | 'deleted';

export type MasterListItem = {
  masterId: string;
  name: string;
  city: string;
  cityCode: string;
  /** Stored label; `specialization.<value>` translates it, an unknown one shows as stored. */
  specialization: string;
  email: string;
  phone: string;
  rating: number;
  reviewCount: number;
  status: MasterStatus;
  createdAt: string;
};

export type MasterList = {
  items: MasterListItem[];
  /** When `admin-api` built the list from the table — it is cached for a few minutes. */
  builtAt: string;
};

/** The Салон a master is on the Ростер of, or the one he used to be on. */
export type MasterSalon = {
  salonId: string;
  name: string;
  /** The Салон account's own state; `null` when its row is gone entirely — unknown, not healthy. */
  status: MasterStatus | null;
  /** `true` while the master is on this Ростер — then his card lives inside that Салон. */
  current: boolean;
  joinedAt: string | null;
  leftAt: string | null;
};

/** The whole profile of one Майстер, Deleted ones included. */
export type Master = {
  masterId: string;
  name: string;
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
  specialization: string;
  /** Always a usable IANA zone — every date of the card is shown in it, not in the browser's. */
  timezone: string;
  rating: number;
  reviewCount: number;
  bufferMinutes: number;
  bookingForwardDays: number;
  brandColor: string | null;
  language: string | null;
  status: MasterStatus;
  deletedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  shortLinks: { random: ShortLink | null; handle: ShortLink | null };
  /** `null` for a master who has never been on any Ростер. */
  salon: MasterSalon | null;
  createdAt: string;
  updatedAt: string;
};

/** What the administrator may change on a Майстер; the account's email and password are not here. */
export type MasterProfileFields = {
  name: string;
  description: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressCityCode: string;
  addressZipCode: string;
  phone: string;
  specialization: string;
  bufferMinutes: number;
  bookingForwardDays: number;
  brandColor: string | null;
};

/** Only the fields that changed, never the whole form. */
export type MasterProfilePatch = Partial<MasterProfileFields>;

@Injectable({ providedIn: 'root' })
export class MastersClient {
  private readonly http = inject(HttpClient);

  /** Every Незалежний майстер in one response; `refresh` makes the backend rebuild its cache. */
  list(options: { refresh?: boolean } = {}): Observable<MasterList> {
    return this.http.get<MasterList>(adminApiUrl('/admin/masters'), {
      params: options.refresh ? { refresh: 'true' } : {},
    });
  }

  /** A missing master is the card's own screen, not a toast: `NOT_FOUND` is left to the caller. */
  get(masterId: string): Observable<Master> {
    return this.http.get<Master>(adminApiUrl(masterPath(masterId)), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }
}
