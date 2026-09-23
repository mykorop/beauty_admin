import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { CLIENT_STATUS_SEVERITY } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { BlockAction } from '../../shared/block-action/block-action';
import { CardLifetime } from '../../shared/profile-card/card-lifetime';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { ClientCardStore } from './client-card.store';
import { CLIENT_CARD_TABS } from './client-card.tabs';

/**
 * The card of one Клієнт: loads the profile once and frames the tabs with it. A Видалений Клієнт
 * opens like any other, under a banner that says so.
 *
 * Блокування is offered here for the same reason it is on the other two cards — it is about the
 * whole profile — but what it does is narrower, and the dialog says so: the person keeps signing
 * in, keeps their Записи and is only refused a new booking. There is deliberately **no** масове
 * скасування beside it: cancelling a person's visits is a decision for the businesses that took
 * them, not for the platform.
 */
@Component({
  selector: 'app-client-card-page',
  imports: [BlockAction, Message, ProfileCard, Tag, TranslatePipe],
  providers: [CardLifetime, ClientCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-card.page.html',
})
export class ClientCardPage {
  private readonly lifetime = inject(CardLifetime);
  private readonly store = inject(ClientCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly clientId = input.required<string>();

  protected readonly tabs = CLIENT_CARD_TABS;
  protected readonly client = this.store.client;
  protected readonly failure = this.store.failure;
  protected readonly blocking = this.store.blocking;
  /** Belongs to the Клієнт the card is open on, so it starts over when the card opens anew. */
  protected readonly blockDialogOpen = this.lifetime.state(false);

  protected readonly statusSeverity = computed(() => CLIENT_STATUS_SEVERITY[this.client()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `profile.status.${this.client()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.platformDate(this.client()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.platformDate(this.client()?.blockedAt));

  /** The Салон and Майстер twins of this are `SalonCardPage.toggleBlock` and the Майстер's. */
  protected toggleBlock(reason: string): void {
    this.store.toggleBlock(reason, (lifted) => {
      this.blockDialogOpen.set(false);
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t(lifted ? 'unblock.done' : 'block.done'),
        life: 4000,
      });
    });
  }

  constructor() {
    // The router reuses this component between two clients, and between two visits to one: every id
    // it is given opens the card anew.
    effect(() => {
      const clientId = this.clientId();
      untracked(() => this.store.open(clientId));
    });
  }
}
