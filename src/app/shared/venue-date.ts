/**
 * A moment as the venue's own clock shows it. Everything dated on a profile card goes through
 * here: the administrator talks to the owner about "yesterday evening" in the salon's zone, and the
 * browser's zone would quietly shift that.
 */
export function formatVenueDateTime(iso: string | null | undefined, locale: string, timeZone: string): string {
  return formatInVenueZone(iso, locale, { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

/** The day alone, still on the venue's clock: late evening UTC is already tomorrow in Chișinău. */
export function formatVenueDate(iso: string | null | undefined, locale: string, timeZone: string): string {
  return formatInVenueZone(iso, locale, { dateStyle: 'medium', timeZone });
}

function formatInVenueZone(
  iso: string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    // A zone this browser does not know. The raw moment is honest; the browser's zone would not be.
    return date.toISOString();
  }
}

/**
 * The calendar date of an instant on the venue's clock, `YYYY-MM-DD`, or `null` when the instant is
 * not one. The browser's zone would shift a late evening into the next day.
 */
export function venueDate(iso: string, timeZone: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  try {
    // `en-CA` writes a date as `YYYY-MM-DD`.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Today on the venue's clock — the day a screen opens on before anything is read. */
export function venueToday(timeZone: string, now = new Date()): string {
  return venueDate(now.toISOString(), timeZone) ?? now.toISOString().slice(0, 10);
}
