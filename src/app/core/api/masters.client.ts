import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';
import { EDIT_CONFLICT_CODE, HOURS_REFUSAL_CODES, TIME_OFF_REFUSAL_CODES } from './api-error';
import type { DayHours, MasterSchedule, SchedulePattern, TimeOffGroup, TimeOffRequest } from './master-schedule.model';
import { hoursBody, schedulePatternBody, timeOffBody } from './schedule-request';
import type { ShortLink } from './salons.client';

/** A Незалежний майстер wears the same three states as a Салон. */
export type MasterStatus = 'active' | 'blocked' | 'deleted';

/** PrimeNG tag severity of each state — the list and the card mark a Майстер the same way. */
export const MASTER_STATUS_SEVERITY: Record<MasterStatus, 'success' | 'warn' | 'danger'> = {
  active: 'success',
  blocked: 'warn',
  deleted: 'danger',
};

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

const masterUrl = (masterId: string, rest: string): string =>
  adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/${rest}`);

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
    return this.http.get<Master>(adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}`), {
      context: new HttpContext().set(SILENT_ERROR_CODES, ['NOT_FOUND']),
    });
  }

  /**
   * `updatedAt` is the one the administrator saw: if the Майстер changed his profile since, the
   * backend refuses with `EDIT_CONFLICT` — the form's own message, so it is left to the caller.
   */
  updateProfile(
    masterId: string,
    request: { updatedAt: string; patch: MasterProfilePatch; reason?: string },
  ): Observable<Master> {
    const { updatedAt, patch, reason } = request;
    return this.http.patch<Master>(
      adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}`),
      { updatedAt, ...patch, ...(reason ? { reason } : {}) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, [EDIT_CONFLICT_CODE]) },
    );
  }

  /**
   * Блокування, and its lifting — the Салон twin of these, down to the mandatory reason and the
   * card that comes back. Only a Незалежний майстер is blocked here: a Майстер салону earns
   * `MASTER_ON_ROSTER`, worded as a toast like every other refusal of this address.
   */
  block(masterId: string, reason: string): Observable<Master> {
    return this.http.post<Master>(masterUrl(masterId, 'block'), { reason });
  }

  unblock(masterId: string, reason: string): Observable<Master> {
    return this.http.post<Master>(masterUrl(masterId, 'unblock'), { reason });
  }

  /**
   * The Робочий графік of a Незалежний майстер over `[from, to]` of his own calendar: his week, the
   * Ротація, the Відсутності and the Записи — the same answer a Майстер салону gives, so one
   * calendar draws both.
   */
  schedule(masterId: string, window: { from: string; to: string }): Observable<MasterSchedule> {
    return this.http.get<MasterSchedule>(masterUrl(masterId, 'schedule'), { params: window });
  }

  /**
   * The whole resulting week, all seven days. Nothing bounds it — a Незалежний майстер answers to
   * no Салон week — but the schema still refuses a week the domain would not store, and the editor
   * words those refusals itself, so their codes are left to the caller.
   */
  updateHours(masterId: string, request: { days: DayHours[]; reason?: string }): Observable<{ days: DayHours[] }> {
    const { days, reason } = request;
    return this.http.put<{ days: DayHours[] }>(masterUrl(masterId, 'hours'), hoursBody(days, reason), {
      context: new HttpContext().set(SILENT_ERROR_CODES, HOURS_REFUSAL_CODES),
    });
  }

  /** Sets the Ротація, or clears it with `pattern: null` — one call for both. */
  updateSchedulePattern(
    masterId: string,
    request: { pattern: SchedulePattern | null; reason?: string },
  ): Observable<{ schedulePattern: SchedulePattern | null }> {
    const { pattern, reason } = request;
    return this.http.put<{ schedulePattern: SchedulePattern | null }>(
      masterUrl(masterId, 'schedule-pattern'),
      schedulePatternBody(pattern, reason),
    );
  }

  /**
   * Files one Відсутність over a range of dates. `reason` is the Журнал's; the one the Майстер's
   * apps show travels inside `timeOff`. Записи in the way are worded by the form itself, so those
   * codes are left to the caller.
   */
  createTimeOff(masterId: string, request: { timeOff: TimeOffRequest; reason?: string }): Observable<TimeOffGroup> {
    const { timeOff, reason } = request;
    return this.http.post<TimeOffGroup>(masterUrl(masterId, 'time-off'), timeOffBody(timeOff, reason), {
      context: new HttpContext().set(SILENT_ERROR_CODES, TIME_OFF_REFUSAL_CODES),
    });
  }

  /** Removes the whole Відсутність — every date of the group, never one of them. */
  removeTimeOff(masterId: string, groupId: string, reason?: string): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      masterUrl(masterId, `time-off/${encodeURIComponent(groupId)}`),
      reason ? { body: { reason } } : {},
    );
  }
}
