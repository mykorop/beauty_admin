import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl, salonPath } from './admin-api-url';

/** Mirror of the platform's fixed list of specializations; changing it is not the panel's job. */
export const MASTER_SPECIALIZATIONS = [
  'hair_specialist',
  'nail_specialist',
  'makeup_specialist',
  'cosmetologist',
  'barber',
  'esthetician',
  'massage_therapist',
] as const;
export type MasterSpecialization = (typeof MASTER_SPECIALIZATIONS)[number];

/** State of the salon↔master link, not of the account: `INACTIVE` is an ended collaboration. */
export type SalonMasterStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

/** One Майстер салону as the Ростер and his card read him. */
export type SalonMaster = {
  masterId: string;
  /** Власник-майстер: always on the Ростер, never removable. */
  isOwner: boolean;
  masterName: string;
  masterAvatar: string;
  email: string;
  specialization: string;
  status: SalonMasterStatus;
  commissionPercent: number;
  bookingForwardDays: number;
  rating: number;
  reviewCount: number;
  joinedAt: string;
  /** `null` until the link is first edited; goes back as-is with a PATCH. */
  updatedAt: string | null;
};

/** What the administrator may change on a roster link. Its status is not here — on purpose. */
export type SalonMasterFields = {
  specialization: string;
  commissionPercent: number;
  bookingForwardDays: number;
};

/** Only the fields that changed, never the whole form. */
export type SalonMasterPatch = Partial<SalonMasterFields>;

export type SalonInviteStatus = 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'DECLINED';

export const SALON_INVITE_STATUS_SEVERITY: Record<SalonInviteStatus, 'info' | 'success' | 'secondary' | 'danger'> = {
  SENT: 'info',
  ACCEPTED: 'success',
  EXPIRED: 'secondary',
  REVOKED: 'secondary',
  DECLINED: 'danger',
};

/** One Інвайт, read-only. */
export type SalonInvite = {
  inviteId: string;
  email: string;
  specialization: string;
  commissionPercent: number;
  /** Derived by the backend: an unanswered invite past `expiresAt` reads `EXPIRED`. */
  status: SalonInviteStatus;
  respondedAt: string | null;
  /** The invitation email bounced. */
  deliveryFailed: boolean;
  createdAt: string;
  expiresAt: string;
};

export type SalonInvitesPage = { items: SalonInvite[]; nextCursor: string | null };

const salonUrl = (salonId: string, rest: string): string =>
  adminApiUrl(`${salonPath(salonId)}/${rest}`);

/**
 * The Ростер of a Салон and its Інвайти. There is deliberately nothing here that adds a master:
 * a collaboration starts with an accepted Інвайт and with nothing else.
 */
@Injectable({ providedIn: 'root' })
export class SalonMastersClient {
  private readonly http = inject(HttpClient);

  roster(salonId: string): Observable<{ items: SalonMaster[] }> {
    return this.http.get<{ items: SalonMaster[] }>(salonUrl(salonId, 'masters'));
  }

  /** A master outside this Ростер is the card's own screen, not a toast: `NOT_FOUND` is left to the caller. */
  get(salonId: string, masterId: string): Observable<SalonMaster> {
    return this.http.get<SalonMaster>(salonUrl(salonId, `masters/${encodeURIComponent(masterId)}`), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }

  /**
   * Вилучення з Ростеру — a heavy action, so the reason is mandatory. Works in a Видалений salon
   * too. There is nothing to read back but the ended link's status.
   */
  remove(salonId: string, masterId: string, reason: string): Observable<{ status: SalonMasterStatus }> {
    return this.http.delete<{ status: SalonMasterStatus }>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}`),
      { body: { reason } },
    );
  }

  invites(salonId: string, cursor?: string): Observable<SalonInvitesPage> {
    return this.http.get<SalonInvitesPage>(salonUrl(salonId, 'invites'), {
      params: cursor ? { cursor } : {},
    });
  }
}
