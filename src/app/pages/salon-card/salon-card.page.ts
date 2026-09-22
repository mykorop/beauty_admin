import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { finalize, type Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { SALON_STATUS_SEVERITY, SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import type { UpcomingAppointmentsPort } from '../../shared/appointments/appointments.model';
import { UpcomingAppointments } from '../../shared/appointments/upcoming-appointments';
import { BlockAction } from '../../shared/block-action/block-action';
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
  providers: [SalonCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-card.page.html',
})
export class SalonCardPage {
  private readonly client = inject(SalonsClient);
  private readonly appointments = inject(AppointmentsClient);
  private readonly store = inject(SalonCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();

  protected readonly tabs = SALON_CARD_TABS;
  protected readonly salon = this.store.salon.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);
  protected readonly blocking = signal(false);
  protected readonly blockDialogOpen = signal(false);
  /** Filled by `app-upcoming-appointments`; the Блокування dialog states it before it asks. */
  protected readonly upcomingCount = signal<number | null>(null);
  protected readonly cancelUpcomingOpen = signal(false);

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

  /**
   * The dialog's own button decided which way this goes, so the card reads the state it saw, not
   * the one the response brings back. Both answers carry the whole card, so the store swaps it in
   * and the banner, the tag and the button all follow from the one write.
   */
  protected toggleBlock(reason: string): void {
    const salon = this.salon();
    if (!salon || this.blocking()) {
      return;
    }
    const blocked = !!salon.blockedAt;
    this.blocking.set(true);
    const request = blocked
      ? this.client.unblock(salon.salonId, reason)
      : this.client.block(salon.salonId, reason);
    request.pipe(finalize(() => this.blocking.set(false))).subscribe({
      next: (updated) => {
        this.store.salon.set(updated);
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

  /**
   * The Блокування dialog offered the масове скасування and the administrator took it. Блокування
   * itself is left alone: the two decisions each keep their own confirmation and their own reason.
   */
  protected offerUpcomingCancel(): void {
    this.blockDialogOpen.set(false);
    this.cancelUpcomingOpen.set(true);
  }

  constructor() {
    let subscription: Subscription | undefined;
    // The router reuses this component between two salons, so the id is followed, not read once.
    effect((onCleanup) => {
      const salonId = this.salonId();
      this.store.salon.set(null);
      this.failure.set(null);
      // The count belongs to the profile that was showing; carrying it over would flash the last
      // one's «N майбутніх Записів» over this card until the new read lands.
      this.upcomingCount.set(null);
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
