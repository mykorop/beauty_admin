import { inject, Injectable, signal } from '@angular/core';
import type { Master } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { formatVenueDate, formatVenueDateTime } from '../../shared/venue-date';

/**
 * The Незалежний майстер the open card is about. Provided by `MasterCardPage`, read by its tabs —
 * they render inside the card's outlet, so they cannot take it as an input.
 */
@Injectable()
export class MasterCardStore {
  private readonly i18n = inject(I18nService);

  readonly master = signal<Master | null>(null);

  /** A moment on the master's own clock, in the panel's language; reactive to both. */
  venueDate(iso: string | null | undefined): string {
    const master = this.master();
    return master ? formatVenueDateTime(iso, this.i18n.locale(), master.timezone) : '—';
  }

  /** The day alone on the master's own clock. */
  venueDay(iso: string | null | undefined): string {
    const master = this.master();
    return master ? formatVenueDate(iso, this.i18n.locale(), master.timezone) : '—';
  }
}
