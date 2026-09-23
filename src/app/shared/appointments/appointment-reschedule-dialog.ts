import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';
import {
  AppointmentsClient,
  type AppointmentDetails,
  type AvailableSlot,
} from '../../core/api/appointments.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { REASON_MAX_LENGTH } from '../reason-dialog/reason-dialog';
import { formatVenueDateTime, venueDate, venueToday } from '../venue-date';

/**
 * «Перенести Запис»: a day, the free hours of that day, and an optional reason.
 *
 * The grid is the backend's own availability answer with this Запис excluded, so the hour it holds
 * now is offered back — a shift of fifteen minutes is the commonest перенесення there is. Only
 * `available` is selectable: `booked` and `too_short` are drawn, greyed, because "why can I not
 * pick 14:00" is the question the dialog exists to answer, and an empty row answers nothing.
 *
 * The dialog does not perform the move. The caller does, keeps `busy` true meanwhile and closes it
 * (`visible`) on success, so a refusal leaves the picked slot exactly where it was.
 */
@Component({
  selector: 'app-appointment-reschedule-dialog',
  imports: [ButtonDirective, Dialog, InputText, ReactiveFormsModule, Textarea, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'onEscape($event)' },
  template: `
    <p-dialog
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="!busy()"
      [closable]="!busy()"
      [closeOnEscape]="false"
      [header]="'appointments.reschedule.title' | t"
      styleClass="reason-dialog reschedule-dialog"
      [focusOnShow]="false"
      (onShow)="focusDay()"
      (onHide)="restoreFocus()"
      [visible]="visible()"
      (visibleChange)="onVisibilityChange($event)"
    >
      <div class="flex flex-col gap-4 text-sm" data-testid="reschedule-dialog">
        <p class="text-ink" data-testid="reschedule-current">
          {{ 'appointments.reschedule.current' | t: { when: currentWhen() } }}
        </p>

        <label class="flex w-48 flex-col gap-1 text-xs text-muted">
          {{ 'appointments.reschedule.day' | t }}
          <input
            pInputText
            #dayInput
            type="date"
            [disabled]="busy()"
            data-testid="reschedule-day"
            [min]="today()"
            [value]="day()"
            (change)="pickDay($any($event.target).value)"
          />
        </label>

        @if (slots(); as slots) {
          @if (slots.length) {
            <div class="flex flex-wrap gap-2" data-testid="reschedule-slots">
              @for (slot of slots; track slot.startAtUtc) {
                <button
                  type="button"
                  class="reschedule-slot"
                  data-testid="reschedule-slot"
                  [attr.data-status]="slot.status"
                  [attr.aria-pressed]="picked() === slot.startAtUtc"
                  [disabled]="slot.status !== 'available' || busy()"
                  (click)="picked.set(slot.startAtUtc)"
                >
                  {{ slot.localTime }}
                </button>
              }
            </div>
          } @else {
            <p class="text-muted" data-testid="reschedule-no-slots">
              {{ 'appointments.reschedule.noSlots' | t }}
            </p>
          }
        } @else if (failed()) {
          <p class="text-muted" data-testid="reschedule-slots-failed">
            {{ 'appointments.reschedule.slotsFailed' | t }}
          </p>
        } @else {
          <p class="text-muted" data-testid="reschedule-slots-loading">
            {{ 'appointments.details.loading' | t }}
          </p>
        }

        <label class="flex flex-col gap-1 text-muted" for="reschedule-reason">
          {{ 'reasonDialog.reasonOptional' | t }}
          <textarea
            pTextarea
            #reasonInput
            id="reschedule-reason"
            data-testid="reschedule-reason"
            rows="3"
            [maxlength]="maxLength"
            [formControl]="reason"
          ></textarea>
        </label>
      </div>

      <ng-template #footer>
        <button
          pButton
          type="button"
          severity="secondary"
          data-testid="reschedule-cancel"
          [text]="true"
          [label]="'reasonDialog.cancel' | t"
          [disabled]="busy()"
          (click)="visible.set(false)"
        ></button>
        <button
          pButton
          type="button"
          data-testid="reschedule-confirm"
          [label]="'appointments.reschedule.confirm' | t"
          [disabled]="!picked() || busy()"
          [loading]="busy()"
          (click)="confirm()"
        ></button>
      </ng-template>
    </p-dialog>
  `,
})
export class AppointmentRescheduleDialog {
  readonly visible = model(false);
  readonly details = input.required<AppointmentDetails>();
  /** The caller's own call is in flight: nothing can be confirmed twice or dismissed from under it. */
  readonly busy = input(false);

  /** The chosen instant and the reason behind it — the body of the перенесення, already trimmed. */
  readonly confirmed = output<{ startDateTime: string; reason?: string }>();

  private readonly document = inject(DOCUMENT);
  private readonly dayInput = viewChild<ElementRef<HTMLInputElement>>('dayInput');
  private readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');
  private returnFocus: HTMLElement | null = null;
  private returnRegion: HTMLElement | null = null;
  private readonly client = inject(AppointmentsClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);

  protected readonly maxLength = REASON_MAX_LENGTH;
  protected readonly reason = new FormControl('', { nonNullable: true });

  protected readonly today = computed(() => venueToday(this.details().timezone));
  protected readonly day = signal('');
  protected readonly picked = signal<string | null>(null);
  protected readonly slots = signal<AvailableSlot[] | null>(null);
  protected readonly failed = signal(false);

  // The reader's own language, on the venue's clock — as every other dated line in the panel.
  protected readonly currentWhen = computed(() =>
    formatVenueDateTime(this.details().startTime, this.i18n.locale(), this.details().timezone),
  );

  private readonly asked = new Subject<string>();

  constructor() {
    this.destroyRef.onDestroy(() => queueMicrotask(() => this.restoreFocus()));
    effect(() => {
      if (this.visible() && this.busy()) this.reasonInput()?.nativeElement.focus();
    });
    // Every opening starts from the day the Запис is on now — the commonest move is within it —
    // and forgets whatever the last opening had picked or typed.
    effect(() => {
      if (this.visible()) {
        const active = this.document.activeElement;
        this.returnFocus = active instanceof HTMLElement ? active : null;
        this.returnRegion = this.returnFocus?.closest('main') ?? null;
        this.reason.reset();
        this.picked.set(null);
        this.pickDay(this.startDay());
      }
    });

    // One day at a time: asking for another drops the answer to the last one, so a slow reply
    // cannot land under a grid that has since moved on.
    this.asked
      .pipe(
        tap(() => {
          this.slots.set(null);
          this.failed.set(false);
        }),
        switchMap((date) =>
          this.client
            .availableSlots(this.details().appointmentId, date)
            // Worded by the dialog, not by a toast: the reader is looking straight at the grid.
            .pipe(catchError(() => (this.failed.set(true), EMPTY))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => this.slots.set(page.slotOptions));
  }

  protected focusDay(): void {
    this.dayInput()?.nativeElement.focus();
  }

  protected onVisibilityChange(visible: boolean): void {
    // PrimeNG's opening-time backdrop listener must also respect the current busy state.
    if (!this.busy()) this.visible.set(visible);
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.onVisibilityChange(false);
  }

  protected restoreFocus(): void {
    const target = this.returnFocus?.isConnected ? this.returnFocus : this.returnRegion;
    if (target?.isConnected) target.focus();
    this.returnFocus = null;
    this.returnRegion = null;
  }

  /** The Запис's own day on the venue's clock — where the dialog opens. */
  private startDay(): string {
    const details = this.details();
    return venueDate(details.startTime, details.timezone) ?? this.today();
  }

  protected pickDay(date: string): void {
    // A cleared date input reports '': the day the Запис is on is the honest fallback.
    const day = date || this.startDay();
    this.day.set(day);
    this.picked.set(null);
    this.asked.next(day);
  }

  protected confirm(): void {
    const startDateTime = this.picked();
    if (!startDateTime || this.busy()) {
      return;
    }
    const reason = this.reason.value.trim();
    this.confirmed.emit({ startDateTime, ...(reason ? { reason } : {}) });
  }
}
