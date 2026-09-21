import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { forkJoin, type Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { SALON_MASTER_STATUS_SEVERITY, SalonMastersClient } from '../../core/api/salon-masters.client';
import { SalonsClient } from '../../core/api/salons.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SALON_MASTER_CARD_TABS } from './salon-master-card.tabs';
import { SalonMasterStore } from './salon-master.store';

/**
 * The card of one Майстер салону, always inside his Салон: opened from the Ростер and leading back
 * to it. The salon is loaded with him — its clock dates the card, and a Видалений salon makes the
 * card read-only.
 */
@Component({
  selector: 'app-salon-master-card-page',
  imports: [Message, ProfileCard, RouterLink, Tag, TranslatePipe],
  providers: [SalonCardStore, SalonMasterStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (master(); as master) {
      <app-profile-card
        [title]="master.masterName"
        [tabs]="tabs"
        [backLink]="rosterLink()"
        backLabelKey="salonMaster.backToRoster"
      >
        <p-tag cardStatus data-testid="card-status" [severity]="statusSeverity()" [value]="statusLabelKey() | t" />
        @if (master.isOwner) {
          <p-tag cardStatus severity="info" data-testid="card-owner" [value]="'roster.ownerMaster' | t" />
        }
        <p cardContext class="-mt-2 mb-4 text-sm text-slate-600" data-testid="card-context">
          {{ 'salonMaster.inSalon' | t }}
          <a class="font-medium hover:underline" [routerLink]="['/salons', salonId()]">{{ salon()?.name || '—' }}</a>
        </p>
        @if (salon()?.status === 'deleted') {
          <p-message
            cardBanner
            class="mb-4 block"
            severity="error"
            icon="pi pi-trash"
            data-testid="card-deleted-banner"
          >
            {{ 'salonMaster.salonDeletedBanner' | t }}
          </p-message>
        }
      </app-profile-card>
    } @else if (failure() === 'notFound') {
      <p class="text-slate-600" data-testid="card-not-found">{{ 'salonMaster.notFound' | t }}</p>
    } @else if (failure() === 'failed') {
      <p class="text-slate-600" data-testid="card-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonMasterCardPage {
  private readonly salons = inject(SalonsClient);
  private readonly masters = inject(SalonMastersClient);
  private readonly salonStore = inject(SalonCardStore);
  private readonly store = inject(SalonMasterStore);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();
  readonly masterId = input.required<string>();

  protected readonly tabs = SALON_MASTER_CARD_TABS;
  protected readonly salon = this.salonStore.salon.asReadonly();
  protected readonly master = this.store.master.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);

  protected readonly rosterLink = computed(() => `/salons/${encodeURIComponent(this.salonId())}/roster`);
  protected readonly statusSeverity = computed(
    () => SALON_MASTER_STATUS_SEVERITY[this.master()?.status ?? 'ACTIVE'] ?? 'secondary',
  );
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `roster.status.${this.master()?.status ?? 'ACTIVE'}`,
  );

  constructor() {
    let subscription: Subscription | undefined;
    // The router reuses this component between two masters, so the ids are followed, not read once.
    effect((onCleanup) => {
      const salonId = this.salonId();
      const masterId = this.masterId();
      this.store.master.set(null);
      this.salonStore.salon.set(null);
      this.failure.set(null);
      subscription = forkJoin({
        salon: this.salons.get(salonId),
        master: this.masters.get(salonId, masterId),
      }).subscribe({
        next: ({ salon, master }) => {
          this.salonStore.salon.set(salon);
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
