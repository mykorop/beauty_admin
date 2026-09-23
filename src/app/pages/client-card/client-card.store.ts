import { inject, Injectable } from '@angular/core';
import { type Client, ClientsClient } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import {
  type CardFailure,
  cardFailure,
  CardLifetime,
} from '../../shared/profile-card/card-lifetime';
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
 *
 * Nothing outside writes the Клієнт: the card opens on one, and Блокування — the only change the
 * panel makes to a Клієнт — goes through here, bound to the opening that asked (`CardLifetime`).
 */
@Injectable()
export class ClientCardStore {
  private readonly api = inject(ClientsClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly i18n = inject(I18nService);

  private readonly current = this.lifetime.state<Client | null>(null);
  private readonly failed = this.lifetime.state<CardFailure | null>(null);
  private readonly blockingNow = this.lifetime.state(false);

  /** `null` until the opening has read the Клієнт. */
  readonly client = this.current.asReadonly();
  /** Why the opening has nothing to show. */
  readonly failure = this.failed.asReadonly();
  /** A Блокування, or its lifting, is on its way. */
  readonly blocking = this.blockingNow.asReadonly();

  /** Opens the card on `clientId`, anew: nothing asked for before can land on this opening. */
  open(clientId: string): void {
    this.lifetime.renew();
    this.lifetime.run(this.api.get(clientId), {
      next: (client) => this.current.set(client),
      error: (error) => this.failed.set(cardFailure(error)),
    });
  }

  /** The Салон twin of this is `SalonCardStore.toggleBlock`, and it works the same way. */
  toggleBlock(reason: string, accepted: (lifted: boolean) => void): void {
    const client = this.current();
    if (!client || this.blockingNow()) {
      return;
    }
    const lifted = !!client.blockedAt;
    this.blockingNow.set(true);
    this.lifetime.run(
      lifted ? this.api.unblock(client.clientId, reason) : this.api.block(client.clientId, reason),
      {
        next: (updated) => {
          this.current.set(updated);
          accepted(lifted);
        },
        done: () => this.blockingNow.set(false),
      },
    );
  }

  /** A moment on the platform's clock, in the panel's language; reactive to both. */
  platformDate(iso: string | null | undefined): string {
    return formatVenueDateTime(iso, this.i18n.locale(), PLATFORM_TIME_ZONE);
  }
}
