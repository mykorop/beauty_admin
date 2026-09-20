import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import type { Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { SALON_STATUS_SEVERITY, SalonsClient } from '../../core/api/salons.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { SalonCardStore } from './salon-card.store';
import { SALON_CARD_TABS } from './salon-card.tabs';

/**
 * The card of one Салон: loads the profile once and frames the tabs with it. A Deleted salon opens
 * like any other, under a banner that says it is read-only.
 */
@Component({
  selector: 'app-salon-card-page',
  imports: [Message, ProfileCard, Tag, TranslatePipe],
  providers: [SalonCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-card.page.html',
})
export class SalonCardPage {
  private readonly client = inject(SalonsClient);
  private readonly store = inject(SalonCardStore);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();

  protected readonly tabs = SALON_CARD_TABS;
  protected readonly salon = this.store.salon.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);

  protected readonly statusSeverity = computed(() => SALON_STATUS_SEVERITY[this.salon()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `salons.status.${this.salon()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.venueDate(this.salon()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.venueDate(this.salon()?.blockedAt));

  constructor() {
    let subscription: Subscription | undefined;
    // The router reuses this component between two salons, so the id is followed, not read once.
    effect((onCleanup) => {
      const salonId = this.salonId();
      this.store.salon.set(null);
      this.failure.set(null);
      subscription = this.client.get(salonId).subscribe({
        next: (salon) => this.store.salon.set(salon),
        // Any other refusal has already been worded as a toast by the interceptor.
        error: (error: unknown) =>
          this.failure.set(error instanceof ApiError && error.code === 'NOT_FOUND' ? 'notFound' : 'failed'),
      });
      onCleanup(() => subscription?.unsubscribe());
    });
  }
}
