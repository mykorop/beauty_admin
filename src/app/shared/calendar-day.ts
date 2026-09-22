/**
 * A calendar day as the panel passes one around: `YYYY-MM-DD`, with no clock and no zone attached.
 * Every screen whose state lives in the address holds its days in this shape — the Журнал дій, the
 * Записи tab — so the reading and the arithmetic live here once rather than beside each of them.
 */

const DAY_MS = 86_400_000;

const utcMidnight = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/** A day out of an address, or `null` when what stands there is not one. */
export function parseCalendarDay(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  // `Date` rolls 31 February over into March; a day that does not survive the round trip is not one.
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(raw) ? raw : null;
}

export const addCalendarDays = (day: string, days: number): string =>
  new Date(utcMidnight(day) + days * DAY_MS).toISOString().slice(0, 10);

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export const calendarDaysBetween = (from: string, to: string): number =>
  Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
