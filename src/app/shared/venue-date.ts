/**
 * A moment as the venue's own clock shows it. Everything dated on a profile card goes through
 * here: the administrator talks to the owner about "yesterday evening" in the salon's zone, and the
 * browser's zone would quietly shift that.
 */
export function formatVenueDateTime(iso: string | null | undefined, locale: string, timeZone: string): string {
  const date = new Date(iso ?? '');
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
  } catch {
    // A zone this browser does not know. The raw moment is honest; the browser's zone would not be.
    return date.toISOString();
  }
}
