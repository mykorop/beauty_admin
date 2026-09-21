import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { finalize, type Observable } from 'rxjs';
import type { SchedulePattern } from '../../core/api/master-schedule.model';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { buildRotation, MAX_CYCLE_LENGTH, MIN_CYCLE_LENGTH, toRotationForm } from './rotation';
import { formatCalendarDate } from './time-off';

/** The Ротація to store — `null` clears it — and the optional Журнал reason. */
export type RotationSaveRequest = { pattern: SchedulePattern | null; reason?: string };

/**
 * The Ротація of a Майстер: a cycle laid over his week from a date — «2 через 2». Shown, set,
 * changed and removed here, through the `save` it was handed: it does not know whether the Майстер
 * works in a Салон. The cycle only takes days off the week; it carries no hours of its own.
 */
@Component({
  selector: 'app-rotation-section',
  imports: [ReactiveFormsModule, ButtonDirective, InputText, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (editing()) {
      <form
        class="max-w-xl text-sm"
        data-testid="rotation-form"
        [formGroup]="form"
        (ngSubmit)="submit()"
      >
        <div class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-6 py-4">
          <div class="flex flex-wrap gap-6">
            <label class="flex flex-col gap-1 text-slate-500">
              {{ 'rotation.anchorDate' | t }}
              <input
                pInputText
                type="date"
                data-testid="rotation-anchor"
                formControlName="anchorDate"
              />
            </label>
            <label class="flex flex-col gap-1 text-slate-500">
              {{ 'rotation.cycleLength' | t }}
              <input
                pInputText
                type="number"
                class="w-24"
                data-testid="rotation-length"
                formControlName="cycleLength"
                [min]="minLength"
                [max]="maxLength"
              />
            </label>
          </div>
          <div>
            <p class="text-slate-500">{{ 'rotation.workingDays' | t }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              @for (day of cycleDays(); track day.offset) {
                <label
                  class="flex cursor-pointer items-center gap-1 rounded border border-slate-200 px-2 py-1"
                  [class.bg-sky-50]="day.worked"
                >
                  <input
                    type="checkbox"
                    class="size-4"
                    data-testid="rotation-day"
                    [checked]="day.worked"
                    (change)="toggle(day.offset)"
                  />
                  {{ day.offset + 1 }}
                </label>
              }
            </div>
            <p class="mt-2 text-xs text-slate-500">{{ 'rotation.hint' | t }}</p>
          </div>
        </div>

        <label class="mt-4 block text-slate-500" for="rotation-reason">{{
          'salon.edit.reason' | t
        }}</label>
        <input
          pInputText
          id="rotation-reason"
          class="mt-1 w-full"
          data-testid="rotation-reason"
          maxlength="500"
          formControlName="reason"
        />

        <div class="flex gap-2 pt-4">
          <button
            pButton
            type="submit"
            data-testid="rotation-save"
            [label]="'salon.edit.save' | t"
            [disabled]="!canSave()"
            [loading]="busy()"
          ></button>
          @if (pattern()) {
            <button
              pButton
              type="button"
              severity="danger"
              data-testid="rotation-remove"
              [outlined]="true"
              [label]="'rotation.remove' | t"
              [disabled]="busy()"
              (click)="store(null)"
            ></button>
          }
          <button
            pButton
            type="button"
            severity="secondary"
            data-testid="rotation-cancel"
            [text]="true"
            [label]="'salon.edit.cancel' | t"
            [disabled]="busy()"
            (click)="editing.set(false)"
          ></button>
        </div>
      </form>
    } @else {
      <div
        class="flex max-w-2xl items-center gap-4 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm"
      >
        <p class="grow" data-testid="rotation-summary" [class.text-slate-500]="!pattern()">
          {{ summary() }}
        </p>
        @if (writable()) {
          <button
            pButton
            type="button"
            size="small"
            icon="pi pi-pencil"
            data-testid="rotation-edit"
            [label]="(pattern() ? 'rotation.change' : 'rotation.set') | t"
            (click)="open()"
          ></button>
        }
      </div>
    }
  `,
})
export class RotationSection {
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** The stored Ротація; `null` — a plain weekly week. */
  readonly pattern = input.required<SchedulePattern | null>();
  /** Today on the venue's clock — where a new cycle starts counting. */
  readonly todayDate = input.required<string>();
  readonly writable = input(true);
  /** Stores the Ротація — or clears it — and answers with it as stored. */
  readonly save =
    input.required<(request: RotationSaveRequest) => Observable<SchedulePattern | null>>();

  readonly saved = output<SchedulePattern | null>();

  protected readonly minLength = MIN_CYCLE_LENGTH;
  protected readonly maxLength = MAX_CYCLE_LENGTH;

  protected readonly form = new FormGroup({
    anchorDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cycleLength: new FormControl(MIN_CYCLE_LENGTH, { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });
  /** Longer than any cycle, so a day marked stays marked while the length is being retyped. */
  private readonly working = signal<boolean[]>([]);
  private readonly value = toSignal(this.form.valueChanges, { initialValue: null });

  protected readonly editing = signal(false);
  protected readonly busy = signal(false);

  protected readonly cycleDays = computed(() => {
    this.value();
    const length = Math.min(
      Math.max(Math.trunc(this.form.controls.cycleLength.value) || 0, 0),
      MAX_CYCLE_LENGTH,
    );
    const working = this.working();
    return Array.from({ length }, (_, offset) => ({ offset, worked: working[offset] ?? false }));
  });

  private readonly built = computed(() => {
    this.value();
    const { anchorDate, cycleLength } = this.form.getRawValue();
    return buildRotation({ anchorDate, cycleLength, working: this.working() });
  });

  protected readonly canSave = computed(() => !this.busy() && this.built() !== null);

  protected readonly summary = computed(() => {
    const pattern = this.pattern();
    return pattern
      ? this.i18n.t('rotation.summary', {
          length: pattern.cycleLength,
          days: pattern.workingOffsets.map((offset) => offset + 1).join(', '),
          date: formatCalendarDate(pattern.anchorDate, this.i18n.locale()),
        })
      : this.i18n.t('rotation.none');
  });

  protected open(): void {
    const { anchorDate, cycleLength, working } = toRotationForm(this.pattern(), this.todayDate());
    this.form.reset({ anchorDate, cycleLength, reason: '' });
    this.working.set(working);
    this.editing.set(true);
  }

  protected toggle(offset: number): void {
    this.working.update((working) => {
      const next = [...working];
      next[offset] = !next[offset];
      return next;
    });
  }

  protected submit(): void {
    const pattern = this.built();
    if (pattern && this.canSave()) {
      this.store(pattern);
    }
  }

  protected store(pattern: SchedulePattern | null): void {
    if (this.busy() || this.form.controls.reason.invalid) {
      return;
    }
    this.busy.set(true);
    this.save()({ pattern, reason: this.form.controls.reason.value.trim() || undefined })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (stored) => {
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t(stored ? 'rotation.saved' : 'rotation.removed'),
            life: 4000,
          });
          this.saved.emit(stored);
          this.editing.set(false);
        },
        // The refusal has already been worded as a toast; the form stays as typed.
        error: () => undefined,
      });
  }
}
