import {
  ACTIVITY_OUTCOMES,
  ACTIVITY_ROLE_FILTERS,
  ACTIVITY_SERVICES,
  type ActivityLogQuery,
  type ActivityOutcome,
  type ActivityRoleFilter,
  type ActivityService,
} from '../../core/api/activity.client';
import { addCalendarDays, parseCalendarDay } from '../../shared/calendar-day';
import { oneOf } from '../../shared/one-of';
import { PLATFORM_TIME_ZONE, zonedDayStart } from '../../shared/platform-clock';

/**
 * The filters of the Журнал активності screen, as the address holds them: the period, its days
 * `YYYY-MM-DD` on the platform's calendar, both inclusive; the account (its id or its email), the
 * Місце (the id of a Салон or a Незалежний майстер), the role, the outcome, the service and the
 * action (a `routeKey`). Nothing set — today, as the backend serves it when it is asked for nothing.
 */
export type ActivityLogFilters = {
  from: string | null;
  to: string | null;
  account: string | null;
  place: string | null;
  role: ActivityRoleFilter | null;
  outcome: ActivityOutcome | null;
  service: ActivityService | null;
  route: string | null;
};

export const NO_ACTIVITY_LOG_FILTERS: ActivityLogFilters = {
  from: null,
  to: null,
  account: null,
  place: null,
  role: null,
  outcome: null,
  service: null,
  route: null,
};

type ParamReader = { get(name: string): string | null };

/** One word, trimmed — an id or an email has no space in it. */
function parseWord(raw: string | null, maxLength: number): string | null {
  const value = raw?.trim() ?? '';
  return value.length <= maxLength && /^\S+$/.test(value) ? value : null;
}

/** An account asked for by its email when it is one — the backend looks the address up — else by its id. */
const isEmail = (account: string): boolean => account.includes('@');

/** The longest id the backend takes; an email may run to the 254 characters an address can have. */
const MAX_ID_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

/** An account: its email, or its id. */
function parseAccount(raw: string | null): string | null {
  const value = parseWord(raw, MAX_EMAIL_LENGTH);
  return value && (isEmail(value) || value.length <= MAX_ID_LENGTH) ? value : null;
}

/** API Gateway's `routeKey` (`PATCH /client/appointments/{appointmentId}/cancel`), or a Cognito action (`auth.code-sent`). */
const ROUTE_KEY = /^(?:[A-Z]+ \/\S{0,190}|[a-z]+(?:\.[a-z-]+)+)$/;

function parseRoute(raw: string | null): string | null {
  const value = raw?.trim() ?? '';
  return ROUTE_KEY.test(value) ? value : null;
}

/**
 * Anything a hand-edited address got wrong reads as "not set" rather than as a refusal: an end that
 * is not a day, a period that ends before it starts, which names no period at all, and a value no
 * filter has.
 */
export function parseActivityLogFilters(params: ParamReader): ActivityLogFilters {
  const from = parseCalendarDay(params.get('from'));
  const to = parseCalendarDay(params.get('to'));
  const backwards = from !== null && to !== null && to < from;
  return {
    from: backwards ? null : from,
    to: backwards ? null : to,
    account: parseAccount(params.get('account')),
    place: parseWord(params.get('place'), MAX_ID_LENGTH),
    role: oneOf(ACTIVITY_ROLE_FILTERS, params.get('role')),
    outcome: oneOf(ACTIVITY_OUTCOMES, params.get('outcome')),
    service: oneOf(ACTIVITY_SERVICES, params.get('service')),
    route: parseRoute(params.get('route')),
  };
}

/** What an input hands over: a value, `''` for a cleared one, `null` for a cleared select. */
export type ActivityLogFilterChange = Partial<Record<keyof ActivityLogFilters, string | null>>;

/**
 * The filters with some set or cleared, as the address will read them back — trimmed, or not set
 * when the value is not one the filter has. An end typed past the other one wins and the other end
 * is dropped, so the address never holds a period that would read back as none.
 */
export function changeFilters(filters: ActivityLogFilters, change: ActivityLogFilterChange): ActivityLogFilters {
  const next: Record<string, string | null> = { ...toQueryParams(filters), ...change };
  if (next['from'] && next['to'] && next['to'] < next['from']) {
    next[change.to === undefined ? 'to' : 'from'] = null;
  }
  return parseActivityLogFilters({ get: (name) => next[name] ?? null });
}

/**
 * What the log shows while no end of a period is set: today — or, for an account or a Місце, whose
 * log the backend reads whole, all it keeps. `null` once a period is set.
 */
export function openPeriod(filters: ActivityLogFilters): 'today' | 'kept' | null {
  if (filters.from || filters.to) {
    return null;
  }
  return filters.account || filters.place ? 'kept' : 'today';
}

/** `null` makes the router drop the parameter, so a cleared filter leaves the address too. */
export function toQueryParams(filters: ActivityLogFilters): Record<string, string | null> {
  return { ...filters };
}

/**
 * What the backend is asked: `from` inclusive and `to` exclusive, as instants on the platform's
 * clock; the account as `account` (an email) or `actorId`; the Місце as `placeId`.
 */
export function toApiFilters(filters: ActivityLogFilters): ActivityLogQuery {
  const { from, to, account, place, role, outcome, service, route } = filters;
  return {
    ...(from ? { from: zonedDayStart(from, PLATFORM_TIME_ZONE) } : {}),
    ...(to ? { to: zonedDayStart(addCalendarDays(to, 1), PLATFORM_TIME_ZONE) } : {}),
    ...(account ? (isEmail(account) ? { account } : { actorId: account }) : {}),
    ...(place ? { placeId: place } : {}),
    ...(role ? { role } : {}),
    ...(outcome ? { outcome } : {}),
    ...(service ? { service } : {}),
    ...(route ? { route } : {}),
  };
}
