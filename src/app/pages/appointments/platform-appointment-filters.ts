import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
  type PlatformAppointmentQuery,
} from '../../core/api/appointments.client';
import { parseAppointmentFilters } from '../../shared/appointments/appointment-filters';
import { parseCalendarDay } from '../../shared/calendar-day';

/**
 * The filters of the наскрізний список Записів, as the address holds them.
 *
 * Two views live at one address, and which one is shown is decided by whether anybody is named.
 * Named — a Салон, a Майстер, a Клієнт, or several — the list is a window of days read from that
 * one's own partition, answered at once. Nobody named, the question is the whole platform, and the
 * table can only answer that one day at a time, by a gathering the backend runs off the request
 * path. So exactly one of `date` and `from`/`to` is ever set: the address never holds a window the
 * view is not showing, or a day it is not.
 *
 * Days are `YYYY-MM-DD` on the platform's calendar — the page spans venues.
 */
export type PlatformAppointmentFilters = {
  salonId: string | null;
  masterId: string | null;
  clientId: string | null;
  /** The platform's day — set only when nobody is named. */
  date: string | null;
  /** The window, both ends inclusive — set only when somebody is named. */
  from: string | null;
  to: string | null;
  status: AppointmentStatus | null;
};

type ParamReader = { get(name: string): string | null };

const idFrom = (params: ParamReader, name: string): string | null =>
  params.get(name)?.trim() || null;

/** Whether the view names somebody — and is therefore a window rather than a day of the platform. */
export function isScoped(
  filters: Pick<PlatformAppointmentFilters, 'salonId' | 'masterId' | 'clientId'>,
): boolean {
  return Boolean(filters.salonId || filters.masterId || filters.clientId);
}

/**
 * Anything a hand-edited address got wrong reads as «not set» rather than as a refusal, and what
 * comes out is always a view the backend will answer: a narrowed window present, in order and
 * inside the cap — the Записи tab's own rules — or one day.
 */
export function parsePlatformAppointmentFilters(
  params: ParamReader,
  platformToday: string,
): PlatformAppointmentFilters {
  const scope = {
    salonId: idFrom(params, 'salonId'),
    masterId: idFrom(params, 'masterId'),
    clientId: idFrom(params, 'clientId'),
  };
  const status = APPOINTMENT_STATUSES.find((value) => value === params.get('status')) ?? null;
  if (!isScoped(scope)) {
    return {
      ...scope,
      date: parseCalendarDay(params.get('date')) ?? platformToday,
      from: null,
      to: null,
      status,
    };
  }
  const { from, to } = parseAppointmentFilters(params, platformToday);
  return { ...scope, date: null, from, to, status };
}

/** `null` makes the router drop the parameter, so what the view does not use leaves the address. */
export function toQueryParams(filters: PlatformAppointmentFilters): Record<string, string | null> {
  return {
    salonId: filters.salonId || null,
    masterId: filters.masterId || null,
    clientId: filters.clientId || null,
    date: filters.date || null,
    from: filters.from || null,
    to: filters.to || null,
    status: filters.status || null,
  };
}

/** Whether the address already spells exactly these filters — if not, the page rewrites it. */
export function matchesAddress(params: ParamReader, filters: PlatformAppointmentFilters): boolean {
  return Object.entries(toQueryParams(filters)).every(
    ([name, value]) => params.get(name) === value,
  );
}

/**
 * What the narrowed list asks the backend — or `null` for a view that names nobody, which is not
 * this read's to answer but a day's gathering.
 */
export function toApiQuery(filters: PlatformAppointmentFilters): PlatformAppointmentQuery | null {
  if (!isScoped(filters) || !filters.from || !filters.to) {
    return null;
  }
  return {
    from: filters.from,
    to: filters.to,
    ...(filters.salonId ? { salonId: filters.salonId } : {}),
    ...(filters.masterId ? { masterId: filters.masterId } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}
