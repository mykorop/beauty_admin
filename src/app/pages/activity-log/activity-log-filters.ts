import type { ActivityLogQuery } from '../../core/api/activity.client';
import { addCalendarDays, parseCalendarDay } from '../../shared/calendar-day';
import { PLATFORM_TIME_ZONE, zonedDayStart } from '../../shared/platform-clock';

/**
 * The filters of the Журнал активності screen, as the address holds them: the period, its days
 * `YYYY-MM-DD` on the platform's calendar, both inclusive. Neither end set — today, as the backend
 * serves it when it is asked for no period.
 */
export type ActivityLogFilters = {
  from: string | null;
  to: string | null;
};

export const NO_ACTIVITY_LOG_FILTERS: ActivityLogFilters = { from: null, to: null };

type ParamReader = { get(name: string): string | null };

/**
 * Anything a hand-edited address got wrong reads as "not set" rather than as a refusal: an end that
 * is not a day, and a period that ends before it starts, which names no period at all.
 */
export function parseActivityLogFilters(params: ParamReader): ActivityLogFilters {
  const from = parseCalendarDay(params.get('from'));
  const to = parseCalendarDay(params.get('to'));
  return from && to && to < from ? NO_ACTIVITY_LOG_FILTERS : { from, to };
}

/**
 * The period with one end set or cleared. An end typed past the other one wins and the other end
 * is dropped, so the address never holds a period that would read back as none.
 */
export function changePeriod(
  filters: ActivityLogFilters,
  change: Partial<ActivityLogFilters>,
): ActivityLogFilters {
  const next = { ...filters, ...change };
  if (next.from && next.to && next.to < next.from) {
    return change.to === undefined ? { ...next, to: null } : { ...next, from: null };
  }
  return next;
}

/** `null` makes the router drop the parameter, so a cleared filter leaves the address too. */
export function toQueryParams(filters: ActivityLogFilters): Record<string, string | null> {
  return { ...filters };
}

/** What the backend is asked: `from` inclusive and `to` exclusive, as instants on the platform's clock. */
export function toApiFilters(filters: ActivityLogFilters): ActivityLogQuery {
  return {
    ...(filters.from ? { from: zonedDayStart(filters.from, PLATFORM_TIME_ZONE) } : {}),
    ...(filters.to ? { to: zonedDayStart(addCalendarDays(filters.to, 1), PLATFORM_TIME_ZONE) } : {}),
  };
}
