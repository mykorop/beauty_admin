import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import type { Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { MASTER_STATUS_SEVERITY, MastersClient } from '../../core/api/masters.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { MasterCardStore } from './master-card.store';
import { MASTER_CARD_TABS } from './master-card.tabs';

/**
 * The card of one Незалежний майстер: loads the profile once and frames the tabs with it. A
 * Видалений master opens like any other, under a banner that says it is read-only.
 *
 * A Майстер салону reached by this address is not shown here at all — his card is the one inside
 * his Ростер, and this page sends the reader straight there.
 */
@Component({
  selector: 'app-master-card-page',
  imports: [Message, ProfileCard, Tag, TranslatePipe],
  providers: [MasterCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-card.page.html',
})
export class MasterCardPage {
  private readonly client = inject(MastersClient);
  private readonly router = inject(Router);
  private readonly store = inject(MasterCardStore);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly masterId = input.required<string>();

  protected readonly tabs = MASTER_CARD_TABS;
  protected readonly master = this.store.master.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);

  protected readonly statusSeverity = computed(() => MASTER_STATUS_SEVERITY[this.master()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `profile.status.${this.master()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.venueDate(this.master()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.venueDate(this.master()?.blockedAt));
  protected readonly leftAt = computed(() => this.store.venueDay(this.master()?.salon?.leftAt));

  constructor() {
    let subscription: Subscription | undefined;
    // The router reuses this component between two masters, so the id is followed, not read once.
    effect((onCleanup) => {
      const masterId = this.masterId();
      this.store.master.set(null);
      this.failure.set(null);
      subscription = this.client.get(masterId).subscribe({
        next: (master) => {
          // He is on a Ростер: his card is the one in his Салон, and that address is the real one.
          if (master.salon?.current) {
            void this.router.navigate(['/salons', master.salon.salonId, 'masters', masterId], {
              replaceUrl: true,
            });
            return;
          }
          this.store.master.set(master);
        },
        // Any other refusal has already been worded as a toast by the interceptor.
        error: (error: unknown) =>
          this.failure.set(error instanceof ApiError && error.code === 'NOT_FOUND' ? 'notFound' : 'failed'),
      });
      onCleanup(() => subscription?.unsubscribe());
    });
  }
}
