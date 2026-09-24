import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import {
  AppointmentsClient,
  type AppointmentActionStatus,
  type AppointmentDetails,
} from '../../core/api/appointments.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { reasonAction } from '../reason-dialog/reason-action';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import type { TranslationKey } from '../../i18n/translations';
import { AppointmentInteraction } from './appointment-interaction';
import { AppointmentRescheduleDialog } from './appointment-reschedule-dialog';

/**
 * What the Адміністратор платформи may do to one Запис: скасувати it with a reason, close it as
 * «завершено» or «не з'явився», or move it to another free hour.
 *
 * All four offers stand only over a Запис still «заброньовано» — the backend refuses every other
 * transition, and a button that is always there but always refuses is worse than no button. A
 * closed Запис shows the line that says so instead, because "why can I not cancel this" is the
 * question a disabled row raises.
 *
 * Over a profile that is only read (`writable`) — a Видалений one, or a Майстер салону whose Салон
 * is Видалений — скасування alone stands: it is the one exception the backend makes there, so that
 * the Клієнт is not left before a closed door, and it refuses everything else. Whether the profile
 * may be changed is the list's to say: a card's tab knows it from the card's scope, while a list
 * that spans venues knows nothing of the venue and offers every action, the backend's refusal
 * standing guard.
 *
 * Nothing here decides *whose* Запис it is: the three actions are addressed by the Запис's own id,
 * so one component serves every Записи list alike — a card's tab, a Клієнт's history, the
 * platform's list. Where the answer lands is the list's business: this component sends the action
 * through the list's `AppointmentInteraction`, which takes the answer in even if this card has
 * closed by then.
 */
type StatusOffer = {
  status: AppointmentActionStatus;
  labelKey: TranslationKey;
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  confirmKey: TranslationKey;
  /** Only скасування is owed an explanation: it is the one that reaches the Клієнт. */
  reasonRequired: boolean;
  severity: 'danger' | 'secondary';
};

const OFFERS: StatusOffer[] = [
  {
    status: 'CANCELLED',
    labelKey: 'appointments.action.cancel',
    titleKey: 'appointments.action.cancel.title',
    messageKey: 'appointments.action.cancel.message',
    confirmKey: 'appointments.action.cancel.confirm',
    reasonRequired: true,
    severity: 'danger',
  },
  {
    status: 'COMPLETED',
    labelKey: 'appointments.action.complete',
    titleKey: 'appointments.action.complete.title',
    messageKey: 'appointments.action.complete.message',
    confirmKey: 'appointments.action.complete.confirm',
    reasonRequired: false,
    severity: 'secondary',
  },
  {
    status: 'NO_SHOW',
    labelKey: 'appointments.action.noShow',
    titleKey: 'appointments.action.noShow.title',
    messageKey: 'appointments.action.noShow.message',
    confirmKey: 'appointments.action.noShow.confirm',
    reasonRequired: false,
    severity: 'secondary',
  },
];

@Component({
  selector: 'app-appointment-actions',
  imports: [AppointmentRescheduleDialog, ButtonDirective, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (actionable()) {
      <div class="mt-4 flex flex-wrap gap-2 border-t border-divider pt-4" data-testid="appointment-actions">
        @for (offer of offers(); track offer.status) {
          <button
            pButton
            type="button"
            size="small"
            [outlined]="true"
            [attr.data-testid]="'appointment-action-' + offer.status"
            [severity]="offer.severity"
            [label]="offer.labelKey | t"
            [disabled]="busy()"
            (click)="statusChange.ask(offer)"
          ></button>
        }
        @if (writable()) {
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-calendar"
            data-testid="appointment-action-reschedule"
            [outlined]="true"
            [label]="'appointments.action.reschedule' | t"
            [disabled]="busy()"
            (click)="rescheduling.set(true)"
          ></button>
        }
      </div>

      @if (statusChange.asked(); as offer) {
        <app-reason-dialog
          [titleKey]="offer.titleKey"
          [confirmLabelKey]="offer.confirmKey"
          [confirmSeverity]="offer.severity === 'danger' ? 'danger' : 'primary'"
          [reasonRequired]="statusChange.reasonRequired()"
          [busy]="statusChange.busy()"
          [visible]="true"
          (visibleChange)="$event || statusChange.dismiss()"
          (confirmed)="statusChange.confirm($event)"
        >
          {{ offer.messageKey | t: { client: details().clientName || '—' } }}
        </app-reason-dialog>
      }

      <app-appointment-reschedule-dialog
        [details]="details()"
        [busy]="moving()"
        [(visible)]="rescheduling"
        (confirmed)="applyReschedule($event)"
      />
    } @else {
      <p class="mt-4 border-t border-divider pt-4 text-xs text-muted" data-testid="appointment-actions-closed">
        {{ 'appointments.action.closed' | t }}
      </p>
    }
  `,
})
export class AppointmentActions {
  readonly details = input.required<AppointmentDetails>();
  /** The Запис's profile may be changed — see above. */
  readonly writable = input(true);

  private readonly client = inject(AppointmentsClient);
  private readonly interaction = inject(AppointmentInteraction);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly offers = computed(() =>
    this.writable() ? OFFERS : OFFERS.filter((offer) => offer.status === 'CANCELLED'),
  );
  protected readonly rescheduling = signal(false);
  /** A move is on its way. */
  protected readonly moving = signal(false);

  /**
   * «скасувати», «завершено», «не з'явився»: the list takes the answer in whether or not this card
   * is still open (`AppointmentInteraction.act`); the action only ends its own wait and closes its
   * dialog.
   */
  protected readonly statusChange = reasonAction({
    run: (reason, offer: StatusOffer) =>
      this.interaction.act(
        this.client.updateStatus(this.details().appointmentId, {
          status: offer.status,
          // The card the administrator is looking at: a Запис that moved since is refused rather
          // than overwritten, and the toast says to reload.
          updatedAt: this.details().updatedAt,
          ...(reason ? { reason } : {}),
        }),
      ),
    reasonRequired: (offer) => offer.reasonRequired,
  });

  /** One action over the Запис at a time, whichever it is. */
  protected readonly busy = computed(() => this.statusChange.busy() || this.moving());

  /** Only a Запис still «заброньовано» can be closed or moved — every other transition is a 409. */
  protected readonly actionable = computed(() => this.details().status === 'BOOKED');

  /**
   * One flight at a time, and the dialog closes only once the backend has agreed: a refusal — an
   * hour taken in the meantime, a Видалений Салон — leaves it open with everything as typed, and
   * the interceptor has already worded the code as a toast.
   */
  protected applyReschedule(request: { startDateTime: string; reason?: string }): void {
    if (this.busy()) {
      return;
    }
    this.moving.set(true);
    // The list takes the answer in whether or not this card is still open; the card only ends its
    // own wait, and stops listening once it is gone.
    this.interaction
      .act(
        this.client.reschedule(this.details().appointmentId, {
          ...request,
          updatedAt: this.details().updatedAt,
        }),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.moving.set(false);
          this.rescheduling.set(false);
        },
        error: () => this.moving.set(false),
      });
  }
}
