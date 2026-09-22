import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { finalize, type Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { CLIENT_STATUS_SEVERITY, ClientsClient } from '../../core/api/clients.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { BlockAction } from '../../shared/block-action/block-action';
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
  providers: [ClientCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-card.page.html',
})
export class ClientCardPage {
  private readonly api = inject(ClientsClient);
  private readonly store = inject(ClientCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly clientId = input.required<string>();

  protected readonly tabs = CLIENT_CARD_TABS;
  protected readonly client = this.store.client.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);
  protected readonly blocking = signal(false);
  protected readonly blockDialogOpen = signal(false);

  protected readonly statusSeverity = computed(() => CLIENT_STATUS_SEVERITY[this.client()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `profile.status.${this.client()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.platformDate(this.client()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.platformDate(this.client()?.blockedAt));

  /** The Салон and Майстер twins of this are `SalonCardPage.toggleBlock` and the Майстер's. */
  protected toggleBlock(reason: string): void {
    const client = this.client();
    if (!client || this.blocking()) {
      return;
    }
    const blocked = !!client.blockedAt;
    this.blocking.set(true);
    const request = blocked
      ? this.api.unblock(client.clientId, reason)
      : this.api.block(client.clientId, reason);
    request.pipe(finalize(() => this.blocking.set(false))).subscribe({
      next: (updated) => {
        this.store.client.set(updated);
        this.blockDialogOpen.set(false);
        this.messages.add({
          severity: 'success',
          summary: this.i18n.t(blocked ? 'unblock.done' : 'block.done'),
          life: 4000,
        });
      },
      // Already worded as a toast; the dialog stays open with the reason as typed.
      error: () => undefined,
    });
  }

  constructor() {
    let subscription: Subscription | undefined;
    // The router reuses this component between two clients, so the id is followed, not read once.
    effect((onCleanup) => {
      const clientId = this.clientId();
      this.store.client.set(null);
      this.failure.set(null);
      subscription = this.api.get(clientId).subscribe({
        next: (client) => this.store.client.set(client),
        // Any other refusal has already been worded as a toast by the interceptor.
        error: (error: unknown) =>
          this.failure.set(error instanceof ApiError && error.code === 'NOT_FOUND' ? 'notFound' : 'failed'),
      });
      onCleanup(() => subscription?.unsubscribe());
    });
  }
}
