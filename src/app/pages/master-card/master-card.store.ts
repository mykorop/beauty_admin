import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { type Master, type MasterProfilePatch, MastersClient } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import {
  type CardAnswer,
  type CardFailure,
  cardFailure,
  CardLifetime,
} from '../../shared/profile-card/card-lifetime';
import { formatVenueDate, formatVenueDateTime } from '../../shared/venue-date';

/**
 * The Незалежний майстер the open card is about. Provided by `MasterCardPage`, read by its tabs —
 * they render inside the card's outlet, so they cannot take it as an input.
 *
 * Nothing outside writes the Майстер: the card opens on one and every change — Блокування, an
 * edit, a reload — goes through here, bound to the opening that asked (`CardLifetime`), exactly
 * as on the Салон's card.
 */
@Injectable()
export class MasterCardStore {
  private readonly client = inject(MastersClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  private readonly current = this.lifetime.state<Master | null>(null);
  private readonly failed = this.lifetime.state<CardFailure | null>(null);
  private readonly blockingNow = this.lifetime.state(false);

  /** `null` until the opening has read the Майстер. */
  readonly master = this.current.asReadonly();
  /** Why the opening has nothing to show. */
  readonly failure = this.failed.asReadonly();
  /** A Блокування, or its lifting, is on its way. */
  readonly blocking = this.blockingNow.asReadonly();

  /** Opens the card on `masterId`, anew: nothing asked for before can land on this opening. */
  open(masterId: string): void {
    this.lifetime.renew();
    this.lifetime.run(this.client.get(masterId), {
      next: (master) => this.showUnlessOnRoster(master),
      error: (error) => this.failed.set(cardFailure(error)),
    });
  }

  /** The Салон twin of this is `SalonCardStore.toggleBlock`, and it works the same way. */
  toggleBlock(reason: string, accepted: (lifted: boolean) => void): void {
    const master = this.current();
    if (!master || this.blockingNow()) {
      return;
    }
    const lifted = !!master.blockedAt;
    this.blockingNow.set(true);
    this.lifetime.run(
      lifted
        ? this.client.unblock(master.masterId, reason)
        : this.client.block(master.masterId, reason),
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
   * Saves an edit of the Профіль under the `updatedAt` the card shows: if the Майстер saved since,
   * the backend refuses with `EDIT_CONFLICT` instead of overwriting that save.
   */
  updateProfile(
    change: { patch: MasterProfilePatch; reason?: string },
    answer: CardAnswer<Master>,
  ): void {
    const master = this.current();
    if (!master) {
      return;
    }
    this.lifetime.run(
      this.client.updateProfile(master.masterId, { updatedAt: master.updatedAt, ...change }),
      {
        ...answer,
        next: (saved) => {
          this.current.set(saved);
          answer.next?.(saved);
        },
      },
    );
  }

  /** Reads the Майстер again — what was saved meanwhile, after an edit conflict. */
  reload(answer: CardAnswer<Master>): void {
    const master = this.current();
    if (!master) {
      return;
    }
    this.lifetime.run(this.client.get(master.masterId), {
      ...answer,
      next: (fresh) => {
        if (this.showUnlessOnRoster(fresh)) {
          answer.next?.(fresh);
        }
      },
    });
  }

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

  /**
   * A read of the current opening becomes the card — unless the Майстер is on a Ростер now: that
   * card is the one inside the Салон, and its address is the real one. A read that lands after the
   * card moved on never gets here, so it sends nobody anywhere.
   */
  private showUnlessOnRoster(master: Master): boolean {
    if (master.salon?.current) {
      void this.router.navigate(['/salons', master.salon.salonId, 'masters', master.masterId], {
        replaceUrl: true,
      });
      return false;
    }
    this.current.set(master);
    return true;
  }
}
