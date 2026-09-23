import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { SALON_MASTER_STATUS_SEVERITY } from '../../core/api/salon-masters.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { CardLifetime } from '../../shared/profile-card/card-lifetime';
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
  providers: [CardLifetime, SalonCardStore, SalonMasterStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (master(); as master) {
      <app-profile-card
        [title]="master.masterName"
        [tabs]="tabs"
        [backLink]="rosterLink()"
        backLabelKey="salonMaster.backToRoster"
      >
        <p-tag
          cardStatus
          data-testid="card-status"
          [severity]="statusSeverity()"
          [value]="statusLabelKey() | t"
        />
        @if (master.isOwner) {
          <p-tag
            cardStatus
            severity="info"
            data-testid="card-owner"
            [value]="'roster.ownerMaster' | t"
          />
        }
        <p cardContext class="-mt-2 mb-4 text-sm text-muted" data-testid="card-context">
          {{ 'salonMaster.inSalon' | t }}
          <a class="font-medium hover:underline" [routerLink]="['/salons', salonId()]">{{
            salon()?.name || '—'
          }}</a>
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
      <p class="text-muted" data-testid="card-not-found">{{ 'salonMaster.notFound' | t }}</p>
    } @else if (failure() === 'failed') {
      <p class="text-muted" data-testid="card-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class SalonMasterCardPage {
  private readonly salonStore = inject(SalonCardStore);
  private readonly store = inject(SalonMasterStore);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();
  readonly masterId = input.required<string>();

  protected readonly tabs = SALON_MASTER_CARD_TABS;
  protected readonly salon = this.salonStore.salon;
  protected readonly master = this.store.master;
  protected readonly failure = this.salonStore.failure;

  protected readonly rosterLink = computed(
    () => `/salons/${encodeURIComponent(this.salonId())}/roster`,
  );
  protected readonly statusSeverity = computed(
    () => SALON_MASTER_STATUS_SEVERITY[this.master()?.status ?? 'ACTIVE'] ?? 'secondary',
  );
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `roster.status.${this.master()?.status ?? 'ACTIVE'}`,
  );

  constructor() {
    // The router reuses this component between two masters and between two Салони, and between two
    // visits to one pair: every pair of ids it is given opens the card anew.
    effect(() => {
      const salonId = this.salonId();
      const masterId = this.masterId();
      untracked(() => this.store.open(salonId, masterId));
    });
  }
}
