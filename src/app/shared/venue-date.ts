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
