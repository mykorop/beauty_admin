import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { actionLevel } from '../profile-card/card-lifetime';
import { cardScope } from '../profile-card/loaded-card';
import { reasonAction } from '../reason-dialog/reason-action';
import { ReasonDialog } from '../reason-dialog/reason-dialog';

/**
 * «N майбутніх Записів» — the warning a Видалений or Заблокований profile carries, and the one
 * action that answers it: cancel them all, with one reason.
 *
 * It exists because Блокування deliberately cancels nothing. The Клієнти of a profile that has
 * just left search still have next Tuesday booked, and nobody on the business's side is going to
 * tell them — so the panel makes the number impossible to miss and the decision a separate,
 * deliberate press, never a side effect of blocking.
 *
 * The number is read **lazily**, once, when something is about to show it: the banner (`warn`) or
 * the Блокування dialog, which states it before it asks for anything (`asked`). A card opened to
 * read a Каталог does not pay for a query over a year of bookings it will not print.
 *
 * The answer to a run is authoritative about what is left (`remaining` — the Записи the backend
 * refused plus whatever its cap left behind), so the count is taken from it rather than re-read.
 * A run that leaves something behind says so and invites another press: the action is idempotent.
 *
 * Whose Записи these are is the card's scope — the warning and the масове скасування read the same
 * for a Салон and for a Незалежний майстер. Both the read and the run belong to the opening of the
 * card they were asked on (`actionLevel`).
 */
@Component({
  selector: 'app-upcoming-appointments',
  imports: [ButtonDirective, Message, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showWarning()) {
      <p-message
        class="mb-4 block"
        severity="warn"
        icon="pi pi-calendar-times"
        data-testid="card-upcoming-banner"
      >
        <span class="flex flex-wrap items-center gap-3">
          <span data-testid="card-upcoming-count">{{
            'upcoming.warning' | t: { count: count() }
          }}</span>
          <button
            pButton
            type="button"
            size="small"
            severity="danger"
            data-testid="upcoming-cancel-open"
            [outlined]="true"
            [label]="'upcoming.cancelAll' | t"
            [disabled]="cancelAll.busy()"
            (click)="ask()"
          ></button>
        </span>
      </p-message>
    }
    <app-reason-dialog
      titleKey="upcoming.title"
      confirmLabelKey="upcoming.confirm"
      [busy]="cancelAll.busy()"
      [visible]="cancelAll.open()"
      (visibleChange)="$event || cancelAll.dismiss()"
      (confirmed)="cancelAll.confirm($event)"
    >
      {{ 'upcoming.message' | t: { name: subject(), count: count() } }}
    </app-reason-dialog>
  `,
})
export class UpcomingAppointments {
  private readonly client = inject(AppointmentsClient);
  private readonly scope = cardScope();

  /** The profile's own name, as the dialog names it. */
  readonly subject = input.required<string>();
  /** The profile is Видалений or Заблокований, so the number is a warning and gets a banner. */
  readonly warn = input(false);
  /** Something else on the card — the Блокування dialog — is about to state the number. */
  readonly asked = input(false);

  /**
   * How many Записи are still ahead, or `null` while it is unknown. Two-way: the card reads it for
   * the Блокування dialog, which states the number before asking for a reason.
   */
  readonly count = model<number | null>(null);

  private readonly level = actionLevel();

  /** The масове скасування itself: every Запис ahead, with one reason. */
  protected readonly cancelAll = reasonAction({
    scope: this.level,
    run: (reason) => this.client.cancelUpcoming(this.scope(), reason),
    accept: ({ remaining }) => this.count.set(remaining),
    toast: ({ cancelled, remaining }) =>
      remaining > 0
        ? { key: 'upcoming.partial', params: { cancelled, remaining }, warn: true }
        : { key: cancelled > 0 ? 'upcoming.done' : 'upcoming.none', params: { cancelled } },
  });

  protected readonly showWarning = computed(() => this.warn() && (this.count() ?? 0) > 0);

  /** Plain field, not a signal: it closes the read, and must not reopen the effect that set it. */
  private requested = false;

  constructor() {
    effect(() => {
      if (this.requested || !(this.warn() || this.asked())) {
        return;
      }
      this.requested = true;
      // A failed read leaves the count unknown, which shows nothing: the interceptor has already
      // worded the refusal, and a warning nobody can act on would be worse than no warning.
      this.level.run(this.client.upcomingCount(this.scope()), {
        next: ({ count }) => this.count.set(count),
      });
    });
  }

  /**
   * Opens the confirmation of the масове скасування — from the banner, or from the Блокування
   * dialog, which offers this action too: the card closes that one and opens this one.
   */
  ask(): void {
    this.cancelAll.ask();
  }
}
