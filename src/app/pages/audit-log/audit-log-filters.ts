import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  type AuditAction,
  type AuditLogQuery,
  type AuditTargetType,
} from '../../core/api/audit.client';
import { addCalendarDays, parseCalendarDay } from '../../shared/calendar-day';
import { PLATFORM_TIME_ZONE, zonedDayStart } from '../../shared/platform-clock';

/** The filters of the Журнал дій screen, as the address holds them; days are `YYYY-MM-DD`, both inclusive. */
export type AuditLogFilters = {
  from: string | null;
  to: string | null;
  targetType: AuditTargetType | null;
  action: AuditAction | null;
};

export const NO_AUDIT_LOG_FILTERS: AuditLogFilters = { from: null, to: null, targetType: null, action: null };

type ParamReader = { get(name: string): string | null };

const oneOf = <T extends string>(allowed: readonly T[], raw: string | null): T | null =>
  allowed.find((value) => value === raw) ?? null;

/** Anything a hand-edited address got wrong reads as "not set" rather than as a refusal. */
export function parseAuditLogFilters(params: ParamReader): AuditLogFilters {
  const from = parseCalendarDay(params.get('from'));
  const to = parseCalendarDay(params.get('to'));
  return {
    from,
    to: from && to && to < from ? null : to,
    targetType: oneOf(AUDIT_TARGET_TYPES, params.get('targetType')),
    action: oneOf(AUDIT_ACTIONS, params.get('action')),
  };
}

/** `null` makes the router drop the parameter, so a cleared filter leaves the address too. */
export function toQueryParams(filters: AuditLogFilters): Record<string, string | null> {
  return { ...filters };
}

/** What the backend is asked: `from` inclusive and `to` exclusive, as instants on the platform's clock. */
export function toApiFilters(filters: AuditLogFilters): AuditLogQuery {
  return {
    ...(filters.from ? { from: zonedDayStart(filters.from, PLATFORM_TIME_ZONE) } : {}),
    ...(filters.to ? { to: zonedDayStart(addCalendarDays(filters.to, 1), PLATFORM_TIME_ZONE) } : {}),
    ...(filters.targetType ? { targetType: filters.targetType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
  };
}
