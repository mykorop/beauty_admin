/**
 * «Оновлено о …» — when `admin-api` built the cached listing the screen is reading, as the reader
 * sees it.
 *
 * Every cached listing carries a `builtAt`, and the three tables and the dashboard all print it the
 * same way. One rule, so the dashboard and the list a tile opens cannot word the same instant
 * differently. Unlike the dates **inside** a card, this one is not a venue's clock but the
 * administrator's own: it says how stale the screen in front of him is.
 */
export function formatBuiltAt(builtAt: string | null | undefined, locale: string): string | null {
  if (!builtAt) {
    return null;
  }
  const date = new Date(builtAt);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
