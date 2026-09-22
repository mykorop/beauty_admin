import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { finalize, type Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { MASTER_STATUS_SEVERITY, MastersClient } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import type { UpcomingAppointmentsPort } from '../../shared/appointments/appointments.model';
import { UpcomingAppointments } from '../../shared/appointments/upcoming-appointments';
import { BlockAction } from '../../shared/block-action/block-action';
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
  providers: [MasterCardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-card.page.html',
})
export class MasterCardPage {
  private readonly client = inject(MastersClient);
  private readonly appointments = inject(AppointmentsClient);
  private readonly router = inject(Router);
  private readonly store = inject(MasterCardStore);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly masterId = input.required<string>();

  protected readonly tabs = MASTER_CARD_TABS;
  protected readonly master = this.store.master.asReadonly();
  protected readonly failure = signal<'notFound' | 'failed' | null>(null);
  protected readonly blocking = signal(false);
  protected readonly blockDialogOpen = signal(false);
  /** Filled by `app-upcoming-appointments`; the Блокування dialog states it before it asks. */
  protected readonly upcomingCount = signal<number | null>(null);
  protected readonly cancelUpcomingOpen = signal(false);

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
    const master = this.master();
    if (!master || this.blocking()) {
      return;
    }
    const blocked = !!master.blockedAt;
    this.blocking.set(true);
    const request = blocked
      ? this.client.unblock(master.masterId, reason)
      : this.client.block(master.masterId, reason);
    request.pipe(finalize(() => this.blocking.set(false))).subscribe({
      next: (updated) => {
        this.store.master.set(updated);
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
    // The router reuses this component between two masters, so the id is followed, not read once.
    effect((onCleanup) => {
      const masterId = this.masterId();
      this.store.master.set(null);
      this.failure.set(null);
      // The count belongs to the profile that was showing; carrying it over would flash the last
      // one's «N майбутніх Записів» over this card until the new read lands.
      this.upcomingCount.set(null);
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
