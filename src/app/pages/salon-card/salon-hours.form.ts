import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { finalize } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { HOURS_REFUSAL_CODES, type SalonDayHours, SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { buildSalonHoursWeek, type DayFormValue, hoursRefusals, toWeekFormValue } from './salon-hours-week';
import { WEEK_ORDER, weekdayName } from '../../shared/weekday';

const dayGroup = (day: DayFormValue) =>
  new FormGroup({
    isOpen: new FormControl(day.isOpen, { nonNullable: true }),
    start: new FormControl(day.start, { nonNullable: true, validators: [Validators.required] }),
    end: new FormControl(day.end, { nonNullable: true, validators: [Validators.required] }),
  });

/**
 * Editing the Години роботи of a Салон: each day open or closed, with one window. Always sends the
 * whole week. The domain stays the judge of it — a refused week is worded here rule by rule, and
 * the form stays as typed so the administrator can fix exactly that.
 */
@Component({
  selector: 'app-salon-hours-form',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Message, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-hours.form.html',
})
export class SalonHoursForm implements OnInit {
  private readonly client = inject(SalonsClient);
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  readonly salonId = input.required<string>();
  /** The stored week the editor opens on. */
  readonly stored = input.required<SalonDayHours[]>();

  readonly saved = output<SalonDayHours[]>();
  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  /** Indexed by `dayOfWeek`; the template walks it Monday first. */
  protected readonly week = new FormArray<ReturnType<typeof dayGroup>>([]);
  protected readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });
  protected readonly form = new FormGroup({ week: this.week, reason: this.reason });
  protected readonly busy = signal(false);
  private readonly refused = signal<unknown>(null);

  private readonly value = toSignal(this.week.valueChanges, { initialValue: null });

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const stored = this.stored();
    return WEEK_ORDER.map((dayOfWeek) => {
      const slots = stored.find((day) => day.dayOfWeek === dayOfWeek && day.isOpen)?.slots ?? [];
      return {
        dayOfWeek,
        name: weekdayName(locale, dayOfWeek),
        // More windows than this editor can hold.
        split: slots.length > 1 ? slots.map((slot) => `${slot.start} – ${slot.end}`).join(', ') : null,
      };
    });
  });

  private readonly days = computed(() => {
    this.value();
    if (!this.week.valid) {
      return null;
    }
    const touched = new Set(this.week.controls.flatMap((day, dayOfWeek) => (day.dirty ? [dayOfWeek] : [])));
    return buildSalonHoursWeek(this.stored(), this.week.getRawValue(), touched);
  });

  protected readonly canSave = computed(() => !this.busy() && this.days() !== null);

  protected readonly refusals = computed(() => {
    const error = this.refused();
    if (!(error instanceof ApiError)) {
      return [];
    }
    const locale = this.i18n.locale();
    const worded = hoursRefusals(error).map(({ key, dayOfWeek, masterName }) => {
      const day = dayOfWeek === undefined ? '' : weekdayName(locale, dayOfWeek);
      return this.i18n.t(key, {
        // A day opens its sentence everywhere but in the master's.
        day: masterName === undefined ? day.charAt(0).toLocaleUpperCase(locale) + day.slice(1) : day,
        master: masterName,
      });
    });
    return worded.length > 0 ? worded : [this.i18n.errorMessage(error.code)];
  });

  ngOnInit(): void {
    for (const day of toWeekFormValue(this.stored())) {
      this.week.push(dayGroup(day), { emitEvent: false });
    }
  }

  /** A touched split day is one window from here on — the hint goes and so do the stored windows. */
  protected touched(dayOfWeek: number): boolean {
    this.value();
    return this.week.at(dayOfWeek).dirty;
  }

  protected save(): void {
    const days = this.days();
    if (!days || !this.canSave() || this.reason.invalid) {
      return;
    }
    this.busy.set(true);
    this.refused.set(null);
    this.client
      .updateHours(this.salonId(), { days, reason: this.reason.value.trim() || undefined })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (hours) => {
          this.messages.add({ severity: 'success', summary: this.i18n.t('hours.edit.saved'), life: 4000 });
          this.saved.emit(hours.days);
          this.closed.emit();
        },
        // Any other refusal has already been worded as a toast; the form stays as typed.
        error: (error: unknown) =>
          this.refused.set(
            error instanceof ApiError && HOURS_REFUSAL_CODES.includes(error.code) ? error : null,
          ),
      });
  }
}
