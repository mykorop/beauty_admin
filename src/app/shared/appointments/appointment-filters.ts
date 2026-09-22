import { APPOINTMENT_STATUSES, type AppointmentQuery, type AppointmentStatus } from '../../core/api/appointments.client';
import { addCalendarDays, calendarDaysBetween, parseCalendarDay } from '../calendar-day';

/**
 * Mirror of the backend's `MAX_APPOINTMENT_WINDOW_DAYS`: a window this wide or wider is refused
 * with `422`. The tab trims instead of asking — and then writes the trimmed window back into the
 * address, so what the reader sees, what the address holds and what the backend was asked are
 * always the same window.
 */
export const MAX_APPOINTMENT_WINDOW_DAYS = 92;

/** How far either side of the venue's today the tab opens: a Запис just past and one just ahead. */
export const DEFAULT_WINDOW_DAYS = 30;

/** The filters of a Записи tab, as the address holds them. Days are `YYYY-MM-DD`, both inclusive. */
export type AppointmentFilters = {
  from: string;
  to: string;
  status: AppointmentStatus | null;
  masterId: string | null;
};

type ParamReader = { get(name: string): string | null };

/** The window the tab opens on when the address names none: around the venue's own today. */
export function defaultAppointmentWindow(venueToday: string): { from: string; to: string } {
  return {
    from: addCalendarDays(venueToday, -DEFAULT_WINDOW_DAYS),
    to: addCalendarDays(venueToday, DEFAULT_WINDOW_DAYS),
  };
}

/**
 * Anything a hand-edited address got wrong reads as «not set» rather than as a refusal, and the
 * window always ends up one the backend will answer: present, in order and inside the cap.
 */
export function parseAppointmentFilters(params: ParamReader, venueToday: string): AppointmentFilters {
  const fallback = defaultAppointmentWindow(venueToday);
  const from = parseCalendarDay(params.get('from')) ?? fallback.from;
  const asked = parseCalendarDay(params.get('to'));
  // The default end, unless the asked start has already moved past it.
  const to = asked && asked >= from ? asked : maxEnd(from, fallback.to);
  const status = APPOINTMENT_STATUSES.find((value) => value === params.get('status')) ?? null;
  const masterId = params.get('masterId')?.trim() || null;
  return { from, to: clampEnd(from, to), status, masterId };
}

const maxEnd = (from: string, fallbackTo: string): string => (fallbackTo >= from ? fallbackTo : from);

/** A window at or past the cap is trimmed to its last answerable day, not refused. */
const clampEnd = (from: string, to: string): string =>
  calendarDaysBetween(from, to) >= MAX_APPOINTMENT_WINDOW_DAYS
    ? addCalendarDays(from, MAX_APPOINTMENT_WINDOW_DAYS - 1)
    : to;

/**
 * `null` makes the router drop the parameter, so a cleared filter leaves the address too — and a
 * cleared date input, which reports `''`, drops the window back to the default rather than asking
 * for an empty one.
 */
export function toQueryParams(filters: {
  from: string | null;
  to: string | null;
  status: AppointmentStatus | null;
  masterId: string | null;
}): Record<string, string | null> {
  return {
    from: filters.from || null,
    to: filters.to || null,
    status: filters.status || null,
    masterId: filters.masterId || null,
  };
}

/** Whether the address already spells exactly these filters — if not, the tab rewrites it. */
export function matchesAddress(params: ParamReader, filters: AppointmentFilters): boolean {
  return Object.entries(toQueryParams(filters)).every(([name, value]) => params.get(name) === value);
}

export function toApiQuery(filters: AppointmentFilters): AppointmentQuery {
  return {
    from: filters.from,
    to: filters.to,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.masterId ? { masterId: filters.masterId } : {}),
  };
}

/**
 * A Запис still «заброньовано» whose time has passed: nobody closed it as завершено, скасовано or
 * «не з'явився». It is the one row of the table that needs the reader's eye, so the tab marks it.
 * Instants compare regardless of zone — the venue's clock decides how the row is *printed*, not
 * whether it is over.
 */
export function isStaleBooking(
  appointment: { status: AppointmentStatus; endTime: string },
  now: Date = new Date(),
): boolean {
  return appointment.status === 'BOOKED' && Date.parse(appointment.endTime) < now.getTime();
}
