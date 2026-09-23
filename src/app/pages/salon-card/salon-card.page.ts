import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { SALON_STATUS_SEVERITY } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import type { UpcomingAppointmentsPort } from '../../shared/appointments/appointments.model';
import { UpcomingAppointments } from '../../shared/appointments/upcoming-appointments';
import { BlockAction } from '../../shared/block-action/block-action';
import { CardLifetime } from '../../shared/profile-card/card-lifetime';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { SalonCardStore } from './salon-card.store';
import { SALON_CARD_TABS } from './salon-card.tabs';

/**
 * The card of one Салон: loads the profile once and frames the tabs with it. A Deleted salon opens
 * like any other, under a banner that says it is read-only.
 *
 * Блокування is offered here rather than on a tab — it is about the whole profile, and the banner
 * that explains the state sits right under the button. So is «N майбутніх Записів»: it is the
 * Клієнти of this profile that Блокування leaves standing, and the number belongs next to the
 * decision that created them, not inside the Записи tab.
 */
@Component({
  selector: 'app-salon-card-page',
  imports: [BlockAction, Message, ProfileCard, Tag, TranslatePipe, UpcomingAppointments],
  providers: [CardLifetime, SalonCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-card.page.html',
})
export class SalonCardPage {
  private readonly appointments = inject(AppointmentsClient);
  private readonly lifetime = inject(CardLifetime);
  private readonly store = inject(SalonCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();

  protected readonly tabs = SALON_CARD_TABS;
  protected readonly salon = this.store.salon;
  protected readonly failure = this.store.failure;
  protected readonly blocking = this.store.blocking;
  // Each belongs to the profile the card is open on, so each starts over when it opens anew.
  protected readonly blockDialogOpen = this.lifetime.state(false);
  /** Filled by `app-upcoming-appointments`; the Блокування dialog states it before it asks. */
  protected readonly upcomingCount = this.lifetime.state<number | null>(null);
  protected readonly cancelUpcomingOpen = this.lifetime.state(false);

  /**
   * Read at call time rather than captured, so the object survives the card being reused for
   * another Салон — the id it asks about is always the one the card is showing.
   */
  protected readonly upcomingPort: UpcomingAppointmentsPort = {
    count: () => this.appointments.salonUpcomingCount(this.salonId()),
    cancelAll: (reason) => this.appointments.cancelSalonUpcoming(this.salonId(), reason),
  };

  protected readonly statusSeverity = computed(() => SALON_STATUS_SEVERITY[this.salon()?.status ?? 'active']);
  protected readonly statusLabelKey = computed<TranslationKey>(
    () => `profile.status.${this.salon()?.status ?? 'active'}`,
  );
  protected readonly deletedAt = computed(() => this.store.venueDate(this.salon()?.deletedAt));
  protected readonly blockedAt = computed(() => this.store.venueDate(this.salon()?.blockedAt));

  /** The dialog closes on success only: a refusal leaves it open with the reason as typed. */
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
    // The router reuses this component between two salons, and between two visits to one: every id
    // it is given opens the card anew.
    effect(() => {
      const salonId = this.salonId();
      untracked(() => this.store.open(salonId));
    });
  }
}
