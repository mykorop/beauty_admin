import { inject, Injectable, signal } from '@angular/core';
import type { Salon } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { formatVenueDate, formatVenueDateTime } from '../../shared/venue-date';

/**
 * The Салон the open card is about. Provided by `SalonCardPage`, read by its tabs — they render
 * inside the card's outlet, so they cannot take it as an input.
 */
@Injectable()
export class SalonCardStore {
  private readonly i18n = inject(I18nService);

  readonly salon = signal<Salon | null>(null);

  /** A moment on the salon's own clock, in the panel's language; reactive to both. */
  venueDate(iso: string | null | undefined): string {
    const salon = this.salon();
    return salon ? formatVenueDateTime(iso, this.i18n.locale(), salon.timezone) : '—';
  }

  /** The day alone on the salon's own clock. */
  venueDay(iso: string | null | undefined): string {
    const salon = this.salon();
    return salon ? formatVenueDate(iso, this.i18n.locale(), salon.timezone) : '—';
  }
}
