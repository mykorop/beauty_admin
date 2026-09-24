import type { TimeOffRequest, TimeOffType } from '../../core/api/master-schedule.model';
import type { TranslationKey } from '../../i18n/translations';

/** The domain's ceiling of one Відсутність, in dates covered (`MAX_TIME_OFF_DAYS`). */
export const MAX_TIME_OFF_DAYS = 90;

export const TIME_OFF_TYPES: readonly TimeOffType[] = ['DAY_OFF', 'CUSTOM_HOURS', 'BLOCKED'];

export const TIME_OFF_TYPE_KEYS: Record<TimeOffType, TranslationKey> = {
  DAY_OFF: 'timeOff.type.DAY_OFF',
  CUSTOM_HOURS: 'timeOff.type.CUSTOM_HOURS',
  BLOCKED: 'timeOff.type.BLOCKED',
};

/** `start` / `end` — the window still worked; they only count for особливі години. */
export type TimeOffFormValue = {
  type: TimeOffType;
  fromDate: string;
  toDate: string;
  start: string;
  end: string;
  reason: string;
};

const DAY_MS = 86_400_000;
const toUtc = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/**
 * What the domain would refuse on sight of the body alone, worded before the request is sent.
 * `todayDate` is the venue's: a range may start in the past, but not end there.
 */
export function timeOffIssue(value: TimeOffFormValue, todayDate: string): TranslationKey | null {
  if (!value.fromDate || !value.toDate) {
    return 'timeOff.issue.dates';
  }
  if (value.fromDate > value.toDate) {
    return 'timeOff.issue.reversed';
  }
  if (value.toDate < todayDate) {
    return 'timeOff.issue.past';
  }
  if ((toUtc(value.toDate) - toUtc(value.fromDate)) / DAY_MS + 1 > MAX_TIME_OFF_DAYS) {
    return 'timeOff.issue.tooLong';
  }
  if (value.type === 'CUSTOM_HOURS' && (!value.start || !value.end || value.start >= value.end)) {
    return 'timeOff.issue.window';
  }
  return null;
}

export function buildTimeOff(value: TimeOffFormValue): TimeOffRequest {
  const reason = value.reason.trim();
  return {
    type: value.type,
    fromDate: value.fromDate,
    toDate: value.toDate,
    ...(value.type === 'CUSTOM_HOURS' ? { slots: [{ start: value.start, end: value.end }] } : {}),
    ...(reason ? { reason } : {}),
  };
}

/** A calendar date (`YYYY-MM-DD`) in words; it has no zone, so it is read and written in UTC. */
export function formatCalendarDate(date: string, locale: string): string {
  const utc = toUtc(date);
  return Number.isNaN(utc)
    ? date
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(utc),
      );
}

/** The period of a Відсутність: one day once, a range with both ends. */
export function formatPeriod(fromDate: string, toDate: string, locale: string): string {
  const from = formatCalendarDate(fromDate, locale);
  return fromDate === toDate ? from : `${from} – ${formatCalendarDate(toDate, locale)}`;
}
