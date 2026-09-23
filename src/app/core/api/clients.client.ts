import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';
import type { AppointmentStatus, VenueAppointment } from './appointments.client';
import type { ReviewsPage } from './reviews.client';

/** A Клієнт wears the same three states as a Салон and a Майстер. */
export type ClientStatus = 'active' | 'blocked' | 'deleted';

/** PrimeNG tag severity of each state — the list and the card mark a Клієнт the same way. */
export const CLIENT_STATUS_SEVERITY: Record<ClientStatus, 'success' | 'warn' | 'danger'> = {
  active: 'success',
  blocked: 'warn',
  deleted: 'danger',
};

/**
 * One row of the Клієнти table. Narrower than a Салон's or a Майстер's on purpose: a Клієнт has no
 * address, no rating and no listing. The table exists to find a person from a support request.
 */
export type ClientListItem = {
  clientId: string;
  /** `firstName lastName`; empty on a profile that never filled them in. */
  name: string;
  email: string;
  phone: string;
  status: ClientStatus;
  createdAt: string;
};

export type ClientList = {
  items: ClientListItem[];
  /** When `admin-api` built the list from the table — it is cached for a few minutes. */
  builtAt: string;
};

/**
 * The whole profile of one Клієнт — and all of it is read-only. There is no PATCH here and none on
 * the backend either: the panel looks a person up to answer a support request and may take them
 * off the platform with a reason, but it never changes someone else's personal data.
 */
export type Client = {
  clientId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  /** The language his app talks to him in; empty when he never chose one. */
  language: string;
  status: ClientStatus;
  deletedAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string | null;
};

/** A page of a Клієнт's own Записи — the feed spans every place the person has visited. */
export type ClientAppointmentsPage = { items: VenueAppointment[]; nextCursor: string | null };

const clientUrl = (clientId: string, rest = ''): string =>
  adminApiUrl(`/admin/clients/${encodeURIComponent(clientId)}${rest}`);

/**
 * Клієнти as the panel reads them. There is deliberately nothing here that **edits** one: the
 * backend has no endpoint for it, and this file is the panel's whole vocabulary for the section.
 */
@Injectable({ providedIn: 'root' })
export class ClientsClient {
  private readonly http = inject(HttpClient);

  /** Every Клієнт in one response; `refresh` makes the backend rebuild its cache. */
  list(options: { refresh?: boolean } = {}): Observable<ClientList> {
    return this.http.get<ClientList>(adminApiUrl('/admin/clients'), {
      params: options.refresh ? { refresh: 'true' } : {},
    });
  }

  /** A missing client is the card's own screen, not a toast: `NOT_FOUND` is left to the caller. */
  get(clientId: string): Observable<Client> {
    return this.http.get<Client>(clientUrl(clientId), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }

  /**
   * His Записи, newest first. No window, unlike a card's Записи tab: this is one person's own
   * history, which is already the bound, and the feed pages by cursor instead.
   */
  appointments(
    clientId: string,
    query: { status?: AppointmentStatus | null; cursor?: string } = {},
  ): Observable<ClientAppointmentsPage> {
    return this.http.get<ClientAppointmentsPage>(clientUrl(clientId, '/appointments'), {
      params: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      },
    });
  }

  /** Everything he has written, newest first — прихованi ones among them. */
  reviews(clientId: string, cursor?: string): Observable<ReviewsPage> {
    return this.http.get<ReviewsPage>(clientUrl(clientId, '/reviews'), {
      params: cursor ? { cursor } : {},
    });
  }

  /**
   * Блокування, and its lifting — the Салон and Майстер twins of these, down to the mandatory
   * reason and the card that comes back. What it does to a Клієнт is narrower: he signs in, sees
   * his Записи and keeps every one already made; only a new booking is refused.
   */
  block(clientId: string, reason: string): Observable<Client> {
    return this.http.post<Client>(clientUrl(clientId, '/block'), { reason });
  }

  unblock(clientId: string, reason: string): Observable<Client> {
    return this.http.post<Client>(clientUrl(clientId, '/unblock'), { reason });
  }
}
