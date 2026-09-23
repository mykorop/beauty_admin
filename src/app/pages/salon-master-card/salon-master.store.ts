import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  type SalonMaster,
  type SalonMasterPatch,
  SalonMastersClient,
  type SalonMasterStatus,
} from '../../core/api/salon-masters.client';
import { type CardAnswer, CardLifetime } from '../../shared/profile-card/card-lifetime';
import { SalonCardStore } from '../salon-card/salon-card.store';

/**
 * The Майстер салону the open card is about. Provided by `SalonMasterCardPage` next to the
 * `SalonCardStore` of his Салон, read by the card's tabs.
 *
 * The card is about the pair: the same Майстер inside another Салон is another card. It opens on
 * both at once, and every change of the link goes through here, bound to that opening — a late
 * answer about another pair, or about an earlier opening of this one, is dropped.
 */
@Injectable()
export class SalonMasterStore {
  private readonly client = inject(SalonMastersClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly salonStore = inject(SalonCardStore);

  private readonly current = this.lifetime.state<SalonMaster | null>(null);

  /** `null` until the opening has read the link, together with its Салон. */
  readonly master = this.current.asReadonly();

  /** Opens the card on the Майстер `masterId` inside the Салон `salonId`, anew. */
  open(salonId: string, masterId: string): void {
    this.salonStore.openWith(salonId, this.client.get(salonId, masterId), (master) =>
      this.current.set(master),
    );
  }

  /**
   * Saves an edit of the link under the `updatedAt` the card shows (`null` for a link nobody edited
   * yet): if the Власник салону saved since, the backend refuses with `EDIT_CONFLICT`.
   */
  update(
    change: { patch: SalonMasterPatch; reason?: string },
    answer: CardAnswer<SalonMaster>,
  ): void {
    const pair = this.pair();
    if (!pair) {
      return;
    }
    const { salonId, master } = pair;
    this.accept(
      this.client.update(salonId, master.masterId, { updatedAt: master.updatedAt, ...change }),
      answer,
    );
  }

  /** Reads the link again — what the Власник салону saved meanwhile, after an edit conflict. */
  reload(answer: CardAnswer<SalonMaster>): void {
    const pair = this.pair();
    if (!pair) {
      return;
    }
    this.accept(this.client.get(pair.salonId, pair.master.masterId), answer);
  }

  /**
   * Вилучення з Ростеру. The link stays on the Ростер as an ended one, so the card stays open on it
   * with the status the answer brings.
   */
  remove(reason: string, answer: CardAnswer<SalonMasterStatus>): void {
    const pair = this.pair();
    if (!pair) {
      return;
    }
    this.lifetime.run(this.client.remove(pair.salonId, pair.master.masterId, reason), {
      ...answer,
      next: ({ status }) => {
        this.current.update((master) => master && { ...master, status });
        answer.next?.(status);
      },
    });
  }

  private pair(): { salonId: string; master: SalonMaster } | null {
    const salon = this.salonStore.salon();
    const master = this.current();
    return salon && master ? { salonId: salon.salonId, master } : null;
  }

  /** The answer becomes the card — header and every tab — before the caller hears of it. */
  private accept(request: Observable<SalonMaster>, answer: CardAnswer<SalonMaster>): void {
    this.lifetime.run(request, {
      ...answer,
      next: (master) => {
        this.current.set(master);
        answer.next?.(master);
      },
    });
  }
}
