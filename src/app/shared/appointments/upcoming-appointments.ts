import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { finalize } from 'rxjs';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import type { UpcomingAppointmentsPort } from './appointments.model';

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
            [disabled]="busy()"
            (click)="open.set(true)"
          ></button>
        </span>
      </p-message>
    }
    <app-reason-dialog
      titleKey="upcoming.title"
      confirmLabelKey="upcoming.confirm"
      [busy]="busy()"
      [(visible)]="open"
      (confirmed)="cancelAll($event)"
    >
      {{ 'upcoming.message' | t: { name: subject(), count: count() } }}
    </app-reason-dialog>
  `,
})
export class UpcomingAppointments {
  /** Whose future Записи these are — both calls go through it. */
  readonly port = input.required<UpcomingAppointmentsPort>();
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

  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  protected readonly busy = signal(false);

  /**
   * The confirmation of the масове скасування. Two-way, because the Блокування dialog offers this
   * action too — the card closes that one and opens this one.
   */
  readonly open = model(false);

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
      this.port()
        .count()
        .subscribe({ next: ({ count }) => this.count.set(count), error: () => undefined });
    });
  }

  protected cancelAll(reason: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.port()
      .cancelAll(reason)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ cancelled, remaining }) => {
          this.count.set(remaining);
          this.open.set(false);
          this.messages.add(
            remaining > 0
              ? {
                  severity: 'warn',
                  summary: this.i18n.t('upcoming.partial', { cancelled, remaining }),
                  life: 8000,
                }
              : {
                  severity: 'success',
                  summary: this.i18n.t(cancelled > 0 ? 'upcoming.done' : 'upcoming.none', {
                    cancelled,
                  }),
                  life: 4000,
                },
          );
        },
        // Already worded as a toast; the dialog stays open with the reason as typed.
        error: () => undefined,
      });
  }
}
