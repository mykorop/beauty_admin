/** Monday first, as every calendar of the region reads; the backend numbers days from Sunday = 0. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** 2024-01-07 was a Sunday, so day `n` of that week names `dayOfWeek = n`. */
const weekdayDate = (dayOfWeek: number): Date => new Date(Date.UTC(2024, 0, 7 + dayOfWeek));

/** «понеділок» — lower-case, as the language writes it mid-sentence. */
export function weekdayName(locale: string, dayOfWeek: number): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(weekdayDate(dayOfWeek));
}
