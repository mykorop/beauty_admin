import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnInit,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { finalize, type Observable } from 'rxjs';
import { ApiError, HOURS_REFUSAL_CODES } from '../../core/api/api-error';
import type { DayHours } from '../../core/api/master-schedule.model';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { WEEK_ORDER, weekdayName } from '../weekday';
import { appointmentsConflict } from './appointments-conflict';
import { AppointmentsConflictView } from './appointments-conflict.view';
import { wordHoursRefusals } from './hours-refusal-wording';
import {
  buildHoursWeek,
  type DayFormValue,
  daysOutsideBounds,
  formatSlots,
  toWeekFormValue,
} from './week-hours';

/**
 * The whole resulting week, all seven days, and the optional Журнал reason. With
 * `allowExistingAppointments` it is saved over the Записи it leaves standing, once they were seen.
 */
export type WeekHoursSaveRequest = {
  days: DayHours[];
  reason?: string;
  allowExistingAppointments?: boolean;
};

const dayGroup = (day: DayFormValue) =>
  new FormGroup({
    isOpen: new FormControl(day.isOpen, { nonNullable: true }),
    start: new FormControl(day.start, { nonNullable: true, validators: [Validators.required] }),
    end: new FormControl(day.end, { nonNullable: true, validators: [Validators.required] }),
  });

/**
 * Editing a stored week — the Години роботи of a Салон or the тижневі години of a Майстер: each day
 * open or closed, with one window. Always sends the whole week, through the `save` it was handed:
 * it knows neither whose week this is nor whether the Майстер works in a Салон. Given `bounds`, it
 * shows them next to each day. The domain stays the judge — a refused week is worded here rule by
 * rule, and the form stays as typed so the administrator can fix exactly that. A week that live
 * Записи would no longer fit — the Майстер's, or for Години роботи anyone's on the Ростер — is
 * refused over them: they are named here, and the same week is saved over them once the
 * administrator confirms. Nothing is cancelled.
 */
@Component({
  selector: 'app-week-hours-editor',
  imports: [
    ReactiveFormsModule,
    AppointmentsConflictView,
    ButtonDirective,
    InputText,
    Message,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './week-hours.editor.html',
})
export class WeekHoursEditor implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** The stored week the editor opens on. */
  readonly stored = input.required<DayHours[]>();
  /** The week this one has to stay inside — the Години роботи of the Майстер's Салон. `null`: none. */
  readonly bounds = input<DayHours[] | null>(null);
  /** Writes the week and answers with it as stored. */
  readonly save = input.required<(request: WeekHoursSaveRequest) => Observable<DayHours[]>>();
  readonly savedMessage = input<TranslationKey>('hours.edit.saved');

  readonly saved = output<DayHours[]>();
  /** Saved or cancelled — either way the tab goes back to reading. */
  readonly closed = output<void>();

  /** Indexed by `dayOfWeek`; the template walks it Monday first. */
  protected readonly week = new FormArray<ReturnType<typeof dayGroup>>([]);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(500)],
  });
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
        split: slots.length > 1 ? formatSlots(slots) : null,
        bounds: this.boundsOf(dayOfWeek),
      };
    });
  });

  private readonly days = computed(() => {
    this.value();
    if (!this.week.valid) {
      return null;
    }
    const touched = new Set(this.week.controls.flatMap((day, dayOfWeek) => (day.dirty ? [dayOfWeek] : [])));
    return buildHoursWeek(this.stored(), this.week.getRawValue(), touched);
  });

  /** Only a hint: the save stays open, and the domain answers for the rule. */
  protected readonly outside = computed(() => {
    this.value();
    return new Set(daysOutsideBounds(this.week.getRawValue(), this.bounds()));
  });

  protected readonly canSave = computed(() => !this.busy() && this.days() !== null);

  protected readonly conflict = computed(() => appointmentsConflict(this.refused()));

  /** The rules a refused week broke — not the Записи in its way, which the conflict names. */
  protected readonly refusals = computed(() => {
    const error = this.refused();
    return error instanceof ApiError && !this.conflict() ? wordHoursRefusals(this.i18n, error) : [];
  });

  constructor() {
    // The Записи were named for the week that was sent: once it changes, they no longer fit it. A
    // broken rule stays in sight while it is being fixed.
    this.week.valueChanges.subscribe(() => {
      if (this.conflict()) {
        this.refused.set(null);
      }
    });
  }

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

  /** What a day has to fit in, as the row shows it; `null` when nothing bounds this week. */
  private boundsOf(dayOfWeek: number): string | null {
    const bounds = this.bounds();
    if (!bounds?.length) {
      return null;
    }
    const day = bounds.find((candidate) => candidate.dayOfWeek === dayOfWeek);
    return day?.isOpen && day.slots.length > 0 ? formatSlots(day.slots) : this.i18n.t('hours.closed');
  }

  /** `confirmed` — the administrator has seen the Записи the week leaves standing. */
  protected submit(confirmed = false): void {
    const days = this.days();
    if (!days || !this.canSave() || this.reason.invalid) {
      return;
    }
    this.busy.set(true);
    this.refused.set(null);
    this.save()({
      days,
      reason: this.reason.value.trim() || undefined,
      allowExistingAppointments: confirmed,
    })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (stored) => {
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t(this.savedMessage()),
            life: 4000,
          });
          this.saved.emit(stored);
          this.closed.emit();
        },
        // Any other refusal has already been worded as a toast; the form stays as typed.
        error: (error: unknown) =>
          this.refused.set(error instanceof ApiError && HOURS_REFUSAL_CODES.includes(error.code) ? error : null),
      });
  }
}
