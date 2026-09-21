/** A rating to one decimal in the panel's language; a dash while nobody has rated yet. */
export function formatRating(locale: string, rating: number, reviewCount: number): string {
  return reviewCount > 0
    ? new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating)
    : '—';
}
