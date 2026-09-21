import {
  ApiError,
  MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE,
  ROSTER_HOURS_OUTSIDE_SALON_HOURS_CODE,
  VALIDATION_ERROR_CODE,
} from '../../core/api/api-error';
import type { TranslationKey } from '../../i18n/translations';
import type { DayHours, TimeSlot } from '../../core/api/master-schedule.model';

/** One day as the editor holds it: open or closed, and a single window. */
export type DayFormValue = { isOpen: boolean; start: string; end: string };

/** What opening a day that has no window yet offers. */
export const DEFAULT_WINDOW = { start: '09:00', end: '18:00' };

const DAYS = [0, 1, 2, 3, 4, 5, 6];

const isWorking = (day: DayHours | undefined): day is DayHours =>
  day !== undefined && day.isOpen && day.slots.length > 0;

/**
 * The stored week as seven editor days, indexed by `dayOfWeek`. A day never set reads as closed. A
 * day its owner split into several windows shows as the one span around them.
 */
export function toWeekFormValue(stored: readonly DayHours[]): DayFormValue[] {
  return DAYS.map((dayOfWeek) => {
    const day = stored.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    return isWorking(day)
      ? { isOpen: true, start: day.slots[0].start, end: day.slots[day.slots.length - 1].end }
      : { isOpen: false, ...DEFAULT_WINDOW };
  });
}

const sameDay = (left: DayFormValue, right: DayFormValue): boolean =>
  left.isOpen === right.isOpen && (!left.isOpen || (left.start === right.start && left.end === right.end));

const isSplit = (day: DayHours | undefined): day is DayHours => isWorking(day) && day.slots.length > 1;

/**
 * The whole week the backend expects — all seven days, by `dayOfWeek` — or `null` when the editor
 * changed nothing. A split day nobody `touched` keeps its stored windows, so a lunch break survives
 * an editor that only knows one window; touching it — even to retype the same span — makes it one.
 */
export function buildHoursWeek(
  stored: readonly DayHours[],
  week: readonly DayFormValue[],
  touched: ReadonlySet<number> = new Set(),
): DayHours[] | null {
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
      return {
        dayOfWeek,
        isOpen: true,
        slots: kept.slots.map(({ start, end }) => ({ start, end })),
      };
    }
    return day.isOpen
      ? { dayOfWeek, isOpen: true, slots: [{ start: day.start, end: day.end }] }
      : { dayOfWeek, isOpen: false, slots: [] };
  });
}

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * The working days of the edited week that do not fit inside `bounds` — for a Майстер салону, the
 * Години роботи of his Салон — by `dayOfWeek`. Only a hint next to the day: the domain stays the
 * judge, and reads bounds that were never stored as holding nothing, as it does (`domain.md` §1d).
 */
export function daysOutsideBounds(week: readonly DayFormValue[], bounds: readonly DayHours[] | null): number[] {
  if (!bounds?.length) {
    return [];
  }
  return week.flatMap((day, dayOfWeek) => {
    if (!day.isOpen) {
      return [];
    }
    const bound = bounds.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    const fits = isWorking(bound)
      ? bound.slots.some(
          (slot) => toMinutes(day.start) >= toMinutes(slot.start) && toMinutes(day.end) <= toMinutes(slot.end),
        )
      : false;
    return fits ? [] : [dayOfWeek];
  });
}

export const formatSlots = (slots: readonly TimeSlot[]): string =>
  slots.map((slot) => `${slot.start} – ${slot.end}`).join(', ');

/** A refusal the form words itself: which sentence, and about which day, master or windows. */
export type HoursRefusal = {
  key: TranslationKey;
  dayOfWeek?: number;
  masterName?: string;
  /** The window that did not fit, and the windows it had to fit in. */
  slot?: string;
  bounds?: string;
};

/** The schema's own messages (`working-hours.schema.ts` in the backend) → the sentence for each. */
const RULE_KEYS: Record<string, TranslationKey> = {
  'the week must have at least one open day': 'hours.refusal.noOpenDay',
  'slot must cover at least one hour': 'hours.refusal.shortWindow',
  'slot start must be earlier than end': 'hours.refusal.startAfterEnd',
};

type OutsideBoundsDetails = {
  dayOfWeek: number;
  outsideSlot: TimeSlot | null;
  salonSlots?: TimeSlot[];
};

/**
 * The domain rules a refused week broke, or `[]` when the refusal is not one this form can word —
 * the caller then falls back to the code's general sentence. The body lists days by `dayOfWeek`,
 * so the index in a `salonHours.<i>…` / `masterHours.<i>…` path is the day itself.
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
  if (error.code === MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE) {
    const details = error.details as OutsideBoundsDetails | undefined;
    if (typeof details?.dayOfWeek !== 'number') {
      return [];
    }
    return [
      details.outsideSlot
        ? {
            key: 'hours.refusal.outsideBounds',
            dayOfWeek: details.dayOfWeek,
            slot: formatSlots([details.outsideSlot]),
            bounds: formatSlots(details.salonSlots ?? []),
          }
        : { key: 'hours.refusal.boundsClosed', dayOfWeek: details.dayOfWeek },
    ];
  }
  if (error.code !== VALIDATION_ERROR_CODE) {
    return [];
  }
  const body = (error.details as { body?: Record<string, string[]> } | undefined)?.body ?? {};
  return Object.entries(body).flatMap(([path, messages]) => {
    const day = /^(?:salonHours|masterHours)\.(\d)\./.exec(path)?.[1];
    return messages
      .filter((message) => message in RULE_KEYS)
      .map((message) => ({
        key: RULE_KEYS[message],
        ...(day === undefined ? {} : { dayOfWeek: Number(day) }),
      }));
  });
}
