import { inject, Injectable } from '@angular/core';
import { forkJoin, type Observable, of } from 'rxjs';
import { type Salon, type SalonProfilePatch, SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import {
  type CardAnswer,
  type CardFailure,
  cardFailure,
  CardLifetime,
} from '../../shared/profile-card/card-lifetime';
import { formatVenueDate, formatVenueDateTime } from '../../shared/venue-date';

/**
 * The Салон the open card is about. Provided by `SalonCardPage`, read by its tabs — they render
 * inside the card's outlet, so they cannot take it as an input. The card of a Майстер салону
 * provides one too: its Салон dates it and makes it read-only.
 *
 * Nothing outside writes the Салон. The card opens on it and every change of it — Блокування, an
 * edit, a reload — goes through here, bound to the opening that asked (`CardLifetime`): an answer
 * that lands after the card has moved on is dropped, whichever profile it is about.
 */
@Injectable()
export class SalonCardStore {
  private readonly client = inject(SalonsClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly i18n = inject(I18nService);

  private readonly current = this.lifetime.state<Salon | null>(null);
  private readonly failed = this.lifetime.state<CardFailure | null>(null);
  private readonly blockingNow = this.lifetime.state(false);

  /** `null` until the opening has read it. */
  readonly salon = this.current.asReadonly();
  /** Why the opening has nothing to show. */
  readonly failure = this.failed.asReadonly();
  /** A Блокування, or its lifting, is on its way. */
  readonly blocking = this.blockingNow.asReadonly();

  /** Opens the card on `salonId`, anew: nothing asked for before can land on this opening. */
  open(salonId: string): void {
    this.openWith(salonId, of(null), () => undefined);
  }

  /**
   * Opens a card that sits inside this Салон — a Майстер салону's — on the pair of them. The Салон
   * is read together with what the inner card reads (`inner`): both land, or the card fails.
   */
  openWith<T>(salonId: string, inner: Observable<T>, accept: (value: T) => void): void {
    this.lifetime.renew();
    this.lifetime.run(forkJoin([this.client.get(salonId), inner]), {
      next: ([salon, value]) => {
        this.current.set(salon);
        accept(value);
      },
      error: (error) => this.failed.set(cardFailure(error)),
    });
  }

  /**
   * Lays a Блокування, or lifts the one the card shows. The dialog's own button decided which way
   * this goes, so the state the card saw decides — not the one the answer brings back. Both answers
   * carry the whole card; `accepted` hears whether it was a lifting.
   */
  toggleBlock(reason: string, accepted: (lifted: boolean) => void): void {
    const salon = this.current();
    if (!salon || this.blockingNow()) {
      return;
    }
    const lifted = !!salon.blockedAt;
    this.blockingNow.set(true);
    this.lifetime.run(
      lifted
        ? this.client.unblock(salon.salonId, reason)
        : this.client.block(salon.salonId, reason),
      {
        next: (updated) => {
          this.current.set(updated);
          accepted(lifted);
        },
        done: () => this.blockingNow.set(false),
      },
    );
  }

  /**
   * Saves an edit of the Профіль under the `updatedAt` the card shows: if the Власник салону saved
   * since, the backend refuses with `EDIT_CONFLICT` instead of overwriting that save.
   */
  updateProfile(
    change: { patch: SalonProfilePatch; reason?: string },
    answer: CardAnswer<Salon>,
  ): void {
    const salon = this.current();
    if (!salon) {
      return;
    }
    this.accept(
      this.client.updateProfile(salon.salonId, { updatedAt: salon.updatedAt, ...change }),
      answer,
    );
  }

  /** Reads the Салон again — what the Власник салону saved meanwhile, after an edit conflict. */
  reload(answer: CardAnswer<Salon>): void {
    const salon = this.current();
    if (!salon) {
      return;
    }
    this.accept(this.client.get(salon.salonId), answer);
  }

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

  /** The answer becomes the card — header and every tab — before the caller hears of it. */
  private accept(request: Observable<Salon>, answer: CardAnswer<Salon>): void {
    this.lifetime.run(request, {
      ...answer,
      next: (salon) => {
        this.current.set(salon);
        answer.next?.(salon);
      },
    });
  }
}
