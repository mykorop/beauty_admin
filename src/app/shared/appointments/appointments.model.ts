import type { Observable } from 'rxjs';
import type {
  AppointmentQuery,
  AppointmentsPage,
  BulkCancelResult,
  UpcomingAppointments,
} from '../../core/api/appointments.client';

/** One Майстер as the tab's filter names him. */
export type AppointmentsFilterMaster = { masterId: string; masterName: string };

/**
 * The reads of a Записи tab, bound to whose Записи it is. The table takes one of these instead of
 * a client and an id, so it knows neither whether it is showing a Салон, a Майстер салону or a
 * Незалежний майстер — which is what lets one tab serve all three cards. One Запис, once opened,
 * is read by its own id (`AppointmentInteraction`), whoever's list it was opened from.
 */
export type AppointmentsPort = {
  /** The venue's clock: every row is printed on it, and the default window is cut on its today. */
  timezone: string;
  /**
   * The Ростер the list may be narrowed by, or `null` when the tab is already one Майстер's — his
   * own card needs neither the filter nor the column that repeats his name on every row.
   */
  masters: Observable<AppointmentsFilterMaster[]> | null;
  list(query: AppointmentQuery): Observable<AppointmentsPage>;
};

/**
 * A profile's **future** Записи, bound to whose they are — the same trick as `AppointmentsPort`,
 * for the same reason: the warning and the масове скасування read identically for a Салон and for
 * a Незалежний майстер, and only the two addresses differ.
 */
export type UpcomingAppointmentsPort = {
  count(): Observable<UpcomingAppointments>;
  cancelAll(reason: string): Observable<BulkCancelResult>;
};
