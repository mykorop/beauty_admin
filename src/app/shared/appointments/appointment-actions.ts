import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { Observable } from 'rxjs';
import {
  AppointmentsClient,
  type AppointmentActionStatus,
  type AppointmentDetails,
} from '../../core/api/appointments.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import type { TranslationKey } from '../../i18n/translations';
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
 * Nothing here decides *whose* Запис it is: the three actions are addressed by the Запис's own id,
 * so one component serves the Салон's tab, the Майстер салону's and the Незалежний майстер's alike
 * — the same reason the table itself takes a `port` instead of a venue.
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
      <div class="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4" data-testid="appointment-actions">
        @for (offer of offers; track offer.status) {
          <button
            pButton
            type="button"
            size="small"
            [outlined]="true"
            [attr.data-testid]="'appointment-action-' + offer.status"
            [severity]="offer.severity"
            [label]="offer.labelKey | t"
            [disabled]="busy()"
            (click)="open.set(offer.status)"
          ></button>
        }
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
      </div>

      @for (offer of offers; track offer.status) {
        @if (open() === offer.status) {
          <app-reason-dialog
            [titleKey]="offer.titleKey"
            [confirmLabelKey]="offer.confirmKey"
            [confirmSeverity]="offer.severity === 'danger' ? 'danger' : 'primary'"
            [reasonRequired]="offer.reasonRequired"
            [busy]="busy()"
            [visible]="true"
            (visibleChange)="closeUnless($event)"
            (confirmed)="applyStatus(offer.status, $event)"
          >
            {{ offer.messageKey | t: { client: details().clientName || '—' } }}
          </app-reason-dialog>
        }
      }

      <app-appointment-reschedule-dialog
        [details]="details()"
        [busy]="busy()"
        [(visible)]="rescheduling"
        (confirmed)="applyReschedule($event)"
      />
    } @else {
      <p class="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500" data-testid="appointment-actions-closed">
        {{ 'appointments.action.closed' | t }}
      </p>
    }
  `,
})
export class AppointmentActions {
  readonly details = input.required<AppointmentDetails>();

  /** The Запис as the backend answered it back — the row and the card both redraw from this. */
  readonly changed = output<AppointmentDetails>();

  private readonly client = inject(AppointmentsClient);

  protected readonly offers = OFFERS;
  protected readonly busy = signal(false);
  /** Which confirmation is open, or `null`. */
  protected readonly open = signal<AppointmentActionStatus | null>(null);
  protected readonly rescheduling = signal(false);

  /** Only a Запис still «заброньовано» can be closed or moved — every other transition is a 409. */
  protected readonly actionable = computed(() => this.details().status === 'BOOKED');

  protected closeUnless(visible: boolean): void {
    if (!visible) {
      this.open.set(null);
    }
  }

  protected applyStatus(status: AppointmentActionStatus, reason: string): void {
    this.run(
      this.client.updateStatus(this.details().appointmentId, {
        status,
        // The card the administrator is looking at: a Запис that moved since is refused rather
        // than overwritten, and the toast says to reload.
        updatedAt: this.details().updatedAt,
        ...(reason ? { reason } : {}),
      }),
      () => this.open.set(null),
    );
  }

  protected applyReschedule(request: { startDateTime: string; reason?: string }): void {
    this.run(
      this.client.reschedule(this.details().appointmentId, {
        ...request,
        updatedAt: this.details().updatedAt,
      }),
      () => this.rescheduling.set(false),
    );
  }

  /**
   * One flight at a time, and the dialog closes only once the backend has agreed: a refusal — an
   * hour taken in the meantime, a Видалений Салон — leaves it open with everything as typed, and
   * the interceptor has already worded the code as a toast.
   */
  private run(call: Observable<AppointmentDetails>, close: () => void): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    call.subscribe({
      next: (updated) => {
        this.busy.set(false);
        close();
        this.changed.emit(updated);
      },
      error: () => this.busy.set(false),
    });
  }
}
