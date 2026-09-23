import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { MASTER_STATUS_SEVERITY } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import type { UpcomingAppointmentsPort } from '../../shared/appointments/appointments.model';
import { UpcomingAppointments } from '../../shared/appointments/upcoming-appointments';
import { BlockAction } from '../../shared/block-action/block-action';
import { CardLifetime } from '../../shared/profile-card/card-lifetime';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { MasterCardStore } from './master-card.store';
import { MASTER_CARD_TABS } from './master-card.tabs';

/**
 * The card of one Незалежний майстер: loads the profile once and frames the tabs with it. A
 * Видалений master opens like any other, under a banner that says it is read-only.
 *
 * A Майстер салону reached by this address is not shown here at all — his card is the one inside
 * his Ростер, and this page sends the reader straight there; that is also why Блокування is offered
 * here — only a Незалежний майстер is his own listing, and only his own listing can leave search.
 */
@Component({
  selector: 'app-master-card-page',
  imports: [BlockAction, Message, ProfileCard, Tag, TranslatePipe, UpcomingAppointments],
  providers: [CardLifetime, MasterCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-card.page.html',
})
export class MasterCardPage {
  private readonly appointments = inject(AppointmentsClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly store = inject(MasterCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly masterId = input.required<string>();

  protected readonly tabs = MASTER_CARD_TABS;
  protected readonly master = this.store.master;
  protected readonly failure = this.store.failure;
  protected readonly blocking = this.store.blocking;
  // Each belongs to the profile the card is open on, so each starts over when it opens anew.
  protected readonly blockDialogOpen = this.lifetime.state(false);
  /** Filled by `app-upcoming-appointments`; the Блокування dialog states it before it asks. */
  protected readonly upcomingCount = this.lifetime.state<number | null>(null);
  protected readonly cancelUpcomingOpen = this.lifetime.state(false);

  /** The Салон twin of this is `SalonCardPage.upcomingPort`, and it works the same way. */
  protected readonly upcomingPort: UpcomingAppointmentsPort = {
    count: () => this.appointments.masterUpcomingCount(this.masterId()),
    cancelAll: (reason) => this.appointments.cancelMasterUpcoming(this.masterId(), reason),
  };

  protected readonly statusSeverity = computed(() => MASTER_STATUS_SEVERITY[this.master()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `profile.status.${this.master()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.venueDate(this.master()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.venueDate(this.master()?.blockedAt));
  protected readonly leftAt = computed(() => this.store.venueDay(this.master()?.salon?.leftAt));

  /** The Салон twin of this is `SalonCardPage.toggleBlock`, and it works the same way. */
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

  /**
   * The Блокування dialog offered the масове скасування and the administrator took it. Блокування
   * itself is left alone: the two decisions each keep their own confirmation and their own reason.
   */
  protected offerUpcomingCancel(): void {
    this.blockDialogOpen.set(false);
    this.cancelUpcomingOpen.set(true);
  }

  constructor() {
    // The router reuses this component between two masters, and between two visits to one: every id
    // it is given opens the card anew.
    effect(() => {
      const masterId = this.masterId();
      untracked(() => this.store.open(masterId));
    });
  }
}
