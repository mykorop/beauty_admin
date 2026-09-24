import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable, of } from 'rxjs';
import type { CardScope } from '../../shared/profile-card/card-scope';
import { SILENT_ERROR_CODES } from './admin-api.interceptor';
import { adminApiUrl } from './admin-api-url';
import { withAllowedAppointments } from './allow-existing-appointments';
import { withReason } from './reason-body';
import { HOURS_REFUSAL_CODES, ROTATION_REFUSAL_CODES, TIME_OFF_REFUSAL_CODES } from './api-error';
import type {
  DayHours,
  MasterSchedule,
  SchedulePattern,
  TimeOffGroup,
  TimeOffRequest,
} from './master-schedule.model';
import { SalonsClient } from './salons.client';

/**
 * The Робочий графік of a Майстер — Незалежний or on a Ростер, the same five calls and the same
 * bodies at his own path. `patternType` is the discriminator the domain's schema expects; a Журнал
 * `reason` is omitted rather than sent empty.
 */
@Injectable({ providedIn: 'root' })
export class WorkingScheduleClient {
  private readonly http = inject(HttpClient);
  private readonly salons = inject(SalonsClient);

  /**
   * The Робочий графік over `[from, to]` of the venue's calendar: his week, the Ротація, the
   * Відсутності and the Записи — everything the month calendar is drawn from.
   */
  read(scope: CardScope, window: { from: string; to: string }): Observable<MasterSchedule> {
    return this.http.get<MasterSchedule>(adminApiUrl(`${scope.base}/schedule`), { params: window });
  }

  /**
   * The Години роботи his week has to stay inside — his Салон's (`domain.md` §1d) — or `null`
   * without a read when nothing bounds it: a Незалежний майстер answers to no Салон week.
   */
  bounds(scope: CardScope): Observable<DayHours[] | null> {
    const bounds = scope.capabilities.scheduleBounds;
    return bounds ? this.salons.hours(bounds.salonId).pipe(map((hours) => hours.days)) : of(null);
  }

  /**
   * The whole resulting week, all seven days. A week the domain refuses — outside the Години роботи
   * of the Салон above all, or over the Записи it would leave standing — is worded by the editor
   * itself, so those codes are left to the caller.
   */
  updateHours(
    scope: CardScope,
    request: { days: DayHours[]; reason?: string; allowExistingAppointments?: boolean },
  ): Observable<{ days: DayHours[] }> {
    const { days, reason, allowExistingAppointments } = request;
    return this.http.put<{ days: DayHours[] }>(
      adminApiUrl(`${scope.base}/hours`),
      {
        masterHours: days,
        ...withReason(reason),
        ...withAllowedAppointments(allowExistingAppointments),
      },
      { context: new HttpContext().set(SILENT_ERROR_CODES, HOURS_REFUSAL_CODES) },
    );
  }

  /**
   * Sets the Ротація, or clears it with `pattern: null` — one call for both. Answers with it as
   * stored. A cycle refused over the Записи it would leave standing is worded by the form itself.
   */
  updateSchedulePattern(
    scope: CardScope,
    request: {
      pattern: SchedulePattern | null;
      reason?: string;
      allowExistingAppointments?: boolean;
    },
  ): Observable<{ schedulePattern: SchedulePattern | null }> {
    const { pattern, reason, allowExistingAppointments } = request;
    return this.http.put<{ schedulePattern: SchedulePattern | null }>(
      adminApiUrl(`${scope.base}/schedule-pattern`),
      {
        pattern: pattern && { patternType: 'CYCLE', ...pattern },
        ...withReason(reason),
        ...withAllowedAppointments(allowExistingAppointments),
      },
      { context: new HttpContext().set(SILENT_ERROR_CODES, ROTATION_REFUSAL_CODES) },
    );
  }

  /**
   * Files one Відсутність over a range of dates. `reason` is the Журнал's; the one the Майстер's apps
   * show travels inside `timeOff`. Записи in the way and a window outside the Години роботи are
   * worded by the form itself, so those codes are left to the caller.
   */
  createTimeOff(
    scope: CardScope,
    request: { timeOff: TimeOffRequest; reason?: string },
  ): Observable<TimeOffGroup> {
    const { timeOff, reason } = request;
    return this.http.post<TimeOffGroup>(
      adminApiUrl(`${scope.base}/time-off`),
      { timeOff, ...withReason(reason) },
      { context: new HttpContext().set(SILENT_ERROR_CODES, TIME_OFF_REFUSAL_CODES) },
    );
  }

  /**
   * Removes the whole Відсутність — every date of the group, never one of them. Not a heavy action
   * — filing it again undoes it — so the Журнал reason is optional.
   */
  removeTimeOff(
    scope: CardScope,
    groupId: string,
    reason?: string,
  ): Observable<{ removed: boolean }> {
    return this.http.delete<{ removed: boolean }>(
      adminApiUrl(`${scope.base}/time-off/${encodeURIComponent(groupId)}`),
      reason ? { body: { reason } } : {},
    );
  }
}
