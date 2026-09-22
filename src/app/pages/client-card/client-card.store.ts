import { inject, Injectable, signal } from '@angular/core';
import type { Client } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { formatVenueDateTime } from '../../shared/venue-date';

/**
 * The Клієнт the open card is about. Provided by `ClientCardPage`, read by its tabs — they render
 * inside the card's outlet, so they cannot take it as an input.
 *
 * Unlike a Салон's or a Майстер's store there is no venue clock to offer: a Клієнт belongs to no
 * place, and his Записи may span several. Everything dated **about him** — registration, the moment
 * a Блокування was laid — is the platform's own clock, as on every screen that spans venues; each
 * Запис of his feed is dated on the clock it was booked under, which travels on its own row.
 */
@Injectable()
export class ClientCardStore {
  private readonly i18n = inject(I18nService);

  readonly client = signal<Client | null>(null);

  /** A moment on the platform's clock, in the panel's language; reactive to both. */
  platformDate(iso: string | null | undefined): string {
    return formatVenueDateTime(iso, this.i18n.locale(), PLATFORM_TIME_ZONE);
  }
}
