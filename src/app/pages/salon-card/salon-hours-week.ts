import { ApiError, ROSTER_HOURS_OUTSIDE_SALON_HOURS_CODE, VALIDATION_ERROR_CODE } from '../../core/api/api-error';
import type { SalonDayHours } from '../../core/api/salons.client';
import type { TranslationKey } from '../../i18n/translations';

/** One day as the editor holds it: open or closed, and a single window. */
export type DayFormValue = { isOpen: boolean; start: string; end: string };

/** What opening a day that has no window yet offers. */
export const DEFAULT_WINDOW = { start: '09:00', end: '18:00' };

const DAYS = [0, 1, 2, 3, 4, 5, 6];

const isWorking = (day: SalonDayHours | undefined): day is SalonDayHours =>
  day !== undefined && day.isOpen && day.slots.length > 0;

/**
 * The stored week as seven editor days, indexed by `dayOfWeek`. A day never set reads as closed. A
 * day the Власник салону split into several windows shows as the one span around them.
 */
export function toWeekFormValue(stored: readonly SalonDayHours[]): DayFormValue[] {
  return DAYS.map((dayOfWeek) => {
    const day = stored.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    return isWorking(day)
      ? { isOpen: true, start: day.slots[0].start, end: day.slots[day.slots.length - 1].end }
      : { isOpen: false, ...DEFAULT_WINDOW };
  });
}

const sameDay = (left: DayFormValue, right: DayFormValue): boolean =>
  left.isOpen === right.isOpen && (!left.isOpen || (left.start === right.start && left.end === right.end));

const isSplit = (day: SalonDayHours | undefined): day is SalonDayHours => isWorking(day) && day.slots.length > 1;

/**
 * The whole week the backend expects — all seven days, by `dayOfWeek` — or `null` when the editor
 * changed nothing. A split day nobody `touched` keeps its stored windows, so a lunch break survives
 * an editor that only knows one window; touching it — even to retype the same span — makes it one.
 */
export function buildSalonHoursWeek(
  stored: readonly SalonDayHours[],
  week: readonly DayFormValue[],
  touched: ReadonlySet<number> = new Set(),
): SalonDayHours[] | null {
  const opened = toWeekFormValue(stored);
  const before = (dayOfWeek: number) => stored.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const keepsSplit = (dayOfWeek: number) => isSplit(before(dayOfWeek)) && !touched.has(dayOfWeek);

  const unchanged = week.every(
    (day, dayOfWeek) => sameDay(day, opened[dayOfWeek]) && (!isSplit(before(dayOfWeek)) || keepsSplit(dayOfWeek)),
  );
  if (unchanged) {
    return null;
  }
  return week.map((day, dayOfWeek) => {
    const kept = before(dayOfWeek);
    if (keepsSplit(dayOfWeek) && isSplit(kept)) {
      return { dayOfWeek, isOpen: true, slots: kept.slots.map(({ start, end }) => ({ start, end })) };
    }
    return day.isOpen
      ? { dayOfWeek, isOpen: true, slots: [{ start: day.start, end: day.end }] }
      : { dayOfWeek, isOpen: false, slots: [] };
  });
}

/** A refusal the form words itself: which sentence, and about which day or master. */
export type HoursRefusal = { key: TranslationKey; dayOfWeek?: number; masterName?: string };

/** The schema's own messages (`working-hours.schema.ts` in the backend) → the sentence for each. */
const RULE_KEYS: Record<string, TranslationKey> = {
  'the week must have at least one open day': 'hours.refusal.noOpenDay',
  'slot must cover at least one hour': 'hours.refusal.shortWindow',
  'slot start must be earlier than end': 'hours.refusal.startAfterEnd',
};

/**
 * The domain rules a refused week broke, or `[]` when the refusal is not one this form can word —
 * the caller then falls back to the code's general sentence. The body lists days by `dayOfWeek`,
 * so the index in a `salonHours.<i>…` path is the day itself.
 */
export function hoursRefusals(error: unknown): HoursRefusal[] {
  if (!(error instanceof ApiError)) {
    return [];
  }
  if (error.code === ROSTER_HOURS_OUTSIDE_SALON_HOURS_CODE) {
    const masters = (error.details as { masters?: { masterName: string; dayOfWeek: number }[] } | undefined)?.masters;
    return (masters ?? []).map(({ masterName, dayOfWeek }) => ({
      key: 'hours.refusal.masterOutside',
      masterName,
      dayOfWeek,
    }));
  }
  if (error.code !== VALIDATION_ERROR_CODE) {
    return [];
  }
  const body = (error.details as { body?: Record<string, string[]> } | undefined)?.body ?? {};
  return Object.entries(body).flatMap(([path, messages]) => {
    const day = /^salonHours\.(\d)\./.exec(path)?.[1];
    return messages
      .filter((message) => message in RULE_KEYS)
      .map((message) => ({ key: RULE_KEYS[message], ...(day === undefined ? {} : { dayOfWeek: Number(day) }) }));
  });
}
