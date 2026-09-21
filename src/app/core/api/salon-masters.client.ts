import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { EDIT_CONFLICT_CODE, HOURS_REFUSAL_CODES, TIME_OFF_REFUSAL_CODES } from './api-error';
import type {
  DayHours,
  MasterSchedule,
  SchedulePattern,
  TimeOffGroup,
  TimeOffRequest,
} from './master-schedule.model';
import { adminApiUrl } from './admin-api-url';

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

export const SALON_MASTER_STATUS_SEVERITY: Record<SalonMasterStatus, 'success' | 'secondary' | 'warn'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  PENDING: 'warn',
};

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
  adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/${rest}`);

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
   * `updatedAt` is the one the administrator saw — `null` for a link nobody has edited yet. If the
   * Власник салону changed the link since, the backend refuses with `EDIT_CONFLICT` — the form's
   * own message, so it is left to the caller.
   */
  update(
    salonId: string,
    masterId: string,
    request: { updatedAt: string | null; patch: SalonMasterPatch; reason?: string },
  ): Observable<SalonMaster> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<SalonMaster>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}`),
      { updatedAt, ...patch, ...(reason ? { reason } : {}) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
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

  /**
   * The Робочий графік of a Майстер салону over `[from, to]` of the salon's calendar: his week, the
   * Ротація, the Відсутності and the Записи — everything the month calendar is drawn from.
   */
  schedule(salonId: string, masterId: string, window: { from: string; to: string }): Observable<MasterSchedule> {
    return this.http.get<MasterSchedule>(salonUrl(salonId, `masters/${encodeURIComponent(masterId)}/schedule`), {
      params: window,
    });
  }

  /**
   * The whole resulting week, all seven days. A week the domain refuses — outside the Години роботи
   * of the Салон above all — is worded by the editor itself, so those codes are left to the caller.
   */
  updateHours(
    salonId: string,
    masterId: string,
    request: { days: DayHours[]; reason?: string },
  ): Observable<{ days: DayHours[] }> {
    const { days, reason } = request;
    return this.http.put<{ days: DayHours[] }>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}/hours`),
      { masterHours: days, ...(reason ? { reason } : {}) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, HOURS_REFUSAL_CODES) },
    );
  }

  /** Sets the Ротація, or clears it with `pattern: null` — one call for both. Answers with it as stored. */
  updateSchedulePattern(
    salonId: string,
    masterId: string,
    request: { pattern: SchedulePattern | null; reason?: string },
  ): Observable<{ schedulePattern: SchedulePattern | null }> {
    const { pattern, reason } = request;
    return this.http.put<{ schedulePattern: SchedulePattern | null }>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}/schedule-pattern`),
      { pattern: pattern && { patternType: 'CYCLE', ...pattern }, ...(reason ? { reason } : {}) },
    );
  }

  /**
   * Files one Відсутність over a range of dates. `reason` is the Журнал's; the one the Майстер's apps
   * show travels inside `timeOff`. Записи in the way and a window outside the Години роботи are
   * worded by the form itself, so those codes are left to the caller.
   */
  createTimeOff(
    salonId: string,
    masterId: string,
    request: { timeOff: TimeOffRequest; reason?: string },
  ): Observable<TimeOffGroup> {
    const { timeOff, reason } = request;
    return this.http.post<TimeOffGroup>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}/time-off`),
      { timeOff, ...(reason ? { reason } : {}) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, TIME_OFF_REFUSAL_CODES) },
    );
  }

  /** Removes the whole Відсутність — every date of the group, never one of them. */
  /** Not a heavy action — filing it again undoes it — so the Журнал reason is optional. */
  removeTimeOff(
    salonId: string,
    masterId: string,
    groupId: string,
    reason?: string,
  ): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      salonUrl(salonId, `masters/${encodeURIComponent(masterId)}/time-off/${encodeURIComponent(groupId)}`),
      reason ? { body: { reason } } : {},
    );
  }

  invites(salonId: string, cursor?: string): Observable<SalonInvitesPage> {
    return this.http.get<SalonInvitesPage>(salonUrl(salonId, 'invites'), {
      params: cursor ? { cursor } : {},
    });
  }
}
