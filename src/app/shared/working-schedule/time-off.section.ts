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
import { Message } from 'primeng/message';
import { finalize, type Observable } from 'rxjs';
import { withAllowedAppointments } from '../../core/api/allow-existing-appointments';
import { ApiError, MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE } from '../../core/api/api-error';
import type {
  TimeOffGroup,
  TimeOffRequest,
  TimeOffType,
} from '../../core/api/master-schedule.model';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { appointmentsConflict } from './appointments-conflict';
import { AppointmentsConflictView } from './appointments-conflict.view';
import { wordHoursRefusals } from './hours-refusal-wording';
import {
  buildTimeOff,
  formatCalendarDate,
  formatPeriod,
  TIME_OFF_TYPE_KEYS,
  TIME_OFF_TYPES,
  timeOffIssue,
} from './time-off';
import { formatSlots } from './week-hours';

/** One Відсутність to file, and the optional Журнал reason — not the one the Майстер's apps show. */
export type TimeOffCreateRequest = { timeOff: TimeOffRequest; reason?: string };

/**
 * The Відсутності of a Майстер, one row per period as it was filed — never per date: what kind it
 * is, and why. Filed over a range of dates and removed whole, through the `create` and `remove` it
 * was handed: it does not know whether the Майстер works in a Салон. Filing a Відсутність cancels
 * nothing — Записи standing in the range are named, and the administrator confirms over them.
 */
@Component({
  selector: 'app-time-off-section',
  imports: [
    ReactiveFormsModule,
    AppointmentsConflictView,
    ButtonDirective,
    InputText,
    Message,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (adding()) {
      <form
        class="schedule-form mb-4 max-w-xl text-sm"
        data-testid="time-off-form"
        [formGroup]="form"
        (ngSubmit)="submit()"
      >
        <div class="flex flex-col gap-4 rounded-lg border border-divider bg-panel px-6 py-4">
          <div class="flex flex-wrap gap-4">
            @for (type of types; track type.value) {
              <label class="flex items-center gap-2">
                <input
                  type="radio"
                  class="schedule-choice"
                  formControlName="type"
                  [value]="type.value"
                  [attr.data-testid]="'time-off-type-' + type.value"
                />
                {{ type.key | t }}
              </label>
            }
          </div>
          <div class="flex flex-wrap gap-6">
            <label class="flex flex-col gap-1 text-muted">
              {{ 'timeOff.from' | t }}
              <input
                pInputText
                type="date"
                data-testid="time-off-from"
                formControlName="fromDate"
              />
            </label>
            <label class="flex flex-col gap-1 text-muted">
              {{ 'timeOff.to' | t }}
              <input pInputText type="date" data-testid="time-off-to" formControlName="toDate" />
            </label>
          </div>
          @if (form.controls.type.value === 'CUSTOM_HOURS') {
            <div>
              <p class="text-muted">{{ 'timeOff.window' | t }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-4">
                <input
                  pInputText
                  type="time"
                  data-testid="time-off-start"
                  formControlName="start"
                  [attr.aria-label]="'hours.edit.from' | t"
                />
                <span aria-hidden="true">–</span>
                <input
                  pInputText
                  type="time"
                  data-testid="time-off-end"
                  formControlName="end"
                  [attr.aria-label]="'hours.edit.to' | t"
                />
              </div>
              <p class="mt-2 text-xs text-muted">{{ 'timeOff.window.hint' | t }}</p>
            </div>
          }
          <label class="flex flex-col gap-1 text-muted">
            {{ 'timeOff.reason' | t }}
            <input
              pInputText
              data-testid="time-off-reason"
              maxlength="200"
              formControlName="reason"
            />
          </label>
        </div>

        <label class="mt-4 block text-muted" for="time-off-audit-reason">{{
          'salon.edit.reason' | t
        }}</label>
        <input
          pInputText
          id="time-off-audit-reason"
          class="mt-1 w-full"
          data-testid="time-off-audit-reason"
          maxlength="500"
          formControlName="auditReason"
        />

        @if (issue(); as issue) {
          <p class="mt-3 text-xs text-warning" data-testid="time-off-issue">{{ issue | t }}</p>
        }
        @if (conflict(); as conflict) {
          <app-appointments-conflict
            class="mt-4"
            testId="time-off"
            message="timeOff.conflict"
            confirmLabel="timeOff.conflict.confirm"
            [conflict]="conflict"
            [busy]="busy()"
            (confirm)="submit(true)"
          />
        }
        @if (refusals().length > 0) {
          <p-message class="mt-4 block" severity="error" icon="pi pi-times-circle">
            <ul>
              @for (refusal of refusals(); track $index) {
                <li data-testid="time-off-refusal">{{ refusal }}</li>
              }
            </ul>
          </p-message>
        }

        <div class="flex flex-wrap gap-2 pt-4">
          <button
            pButton
            type="submit"
            data-testid="time-off-save"
            [label]="'timeOff.create' | t"
            [disabled]="!canSave()"
            [loading]="busy()"
          ></button>
          <button
            pButton
            type="button"
            severity="secondary"
            data-testid="time-off-cancel"
            [text]="true"
            [label]="'salon.edit.cancel' | t"
            [disabled]="busy()"
            (click)="adding.set(false)"
          ></button>
        </div>
      </form>
    } @else if (writable()) {
      <div class="mb-3 flex max-w-4xl justify-end">
        <button
          pButton
          type="button"
          size="small"
          icon="pi pi-plus"
          data-testid="time-off-add"
          [label]="'timeOff.add' | t"
          (click)="open()"
        ></button>
      </div>
    }

    @if (rows().length > 0) {
      <div class="profile-table-scroll max-w-4xl" tabindex="0" role="region" [attr.aria-label]="'timeOff.title' | t"><table class="profile-data-table time-off-table">
        <thead class="text-xs text-muted">
          <tr class="border-b border-divider">
            <th class="px-6 py-3 font-normal">{{ 'timeOff.period' | t }}</th>
            <th class="px-6 py-3 font-normal">{{ 'timeOff.type' | t }}</th>
            <th class="px-6 py-3 font-normal">{{ 'timeOff.reason.column' | t }}</th>
            <th class="px-6 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.groupId) {
            <tr
              class="border-b border-divider align-top last:border-0"
              data-testid="time-off-row"
            >
              <td class="px-6 py-3" data-testid="time-off-period">
                {{ row.period }}
                @if (row.skipped) {
                  <div class="text-xs text-muted" data-testid="time-off-skipped">
                    {{ 'timeOff.skipped' | t: { dates: row.skipped } }}
                  </div>
                }
              </td>
              <td class="px-6 py-3" data-testid="time-off-type">
                {{ row.typeKey | t }}
                @if (row.slots) {
                  <div class="text-xs text-muted">{{ row.slots }}</div>
                }
              </td>
              <td
                class="px-6 py-3 break-words"
                data-testid="time-off-row-reason"
                [class.text-muted]="!row.reason"
              >
                {{ row.reason ?? '—' }}
              </td>
              <td class="px-6 py-3 time-off-actions">
                @if (removing() === row.groupId) {
                  <span class="mr-2 text-xs text-muted">{{
                    'timeOff.remove.confirmText' | t
                  }}</span>
                  <input
                    pInputText
                    class="mr-2 w-56"
                    data-testid="time-off-remove-reason"
                    maxlength="500"
                    [attr.aria-label]="'salon.edit.reason' | t"
                    [placeholder]="'salon.edit.reason' | t"
                    [formControl]="removeReason"
                  />
                  <button
                    pButton
                    type="button"
                    size="small"
                    severity="danger"
                    data-testid="time-off-remove-confirm"
                    [label]="'timeOff.remove' | t"
                    [loading]="busy()"
                    (click)="drop(row.groupId)"
                  ></button>
                  <button
                    pButton
                    type="button"
                    size="small"
                    severity="secondary"
                    data-testid="time-off-remove-cancel"
                    [text]="true"
                    [label]="'salon.edit.cancel' | t"
                    [disabled]="busy()"
                    (click)="removing.set(null)"
                  ></button>
                } @else if (writable()) {
                  <button
                    pButton
                    type="button"
                    size="small"
                    severity="danger"
                    icon="pi pi-trash"
                    data-testid="time-off-remove"
                    [text]="true"
                    [label]="'timeOff.remove' | t"
                    (click)="askToRemove(row.groupId)"
                  ></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table></div>
    } @else {
      <p class="text-sm text-muted" data-testid="time-off-empty">{{ 'timeOff.empty' | t }}</p>
    }
  `,
})
export class TimeOffSection {
  private readonly i18n = inject(I18nService);
  private readonly messages = inject(MessageService);

  /** The Відсутності to list — the host decides over which dates. */
  readonly groups = input.required<TimeOffGroup[]>();
  /** Today on the venue's clock: a Відсутність may start before it, but not end there. */
  readonly todayDate = input.required<string>();
  readonly writable = input(true);
  readonly create = input.required<(request: TimeOffCreateRequest) => Observable<unknown>>();
  readonly remove =
    input.required<(groupId: string, reason?: string) => Observable<unknown>>();

  /**
   * Something was filed or removed. A new Відсутність replaces older ones on the days they share,
   * so the host reads the list again rather than patching it. A filed one names its first date —
   * the host shows the month it landed in, which need not be the one on screen.
   */
  readonly changed = output<string | null>();

  protected readonly types = TIME_OFF_TYPES.map((value) => ({
    value,
    key: TIME_OFF_TYPE_KEYS[value],
  }));

  protected readonly form = new FormGroup({
    type: new FormControl<TimeOffType>('DAY_OFF', { nonNullable: true }),
    fromDate: new FormControl('', { nonNullable: true }),
    toDate: new FormControl('', { nonNullable: true }),
    start: new FormControl('09:00', { nonNullable: true }),
    end: new FormControl('13:00', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    auditReason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: null });

  /** The optional Журнал reason of a removal; blank on every asking. */
  protected readonly removeReason = new FormControl('', { nonNullable: true });

  protected readonly adding = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly busy = signal(false);
  private readonly refused = signal<unknown>(null);

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    return this.groups().map((group) => ({
      groupId: group.groupId,
      period: formatPeriod(group.fromDate, group.toDate, locale),
      skipped:
        group.skippedDates?.map((date) => formatCalendarDate(date, locale)).join(', ') || null,
      typeKey: TIME_OFF_TYPE_KEYS[group.type],
      slots:
        group.type === 'CUSTOM_HOURS' && group.slots.length > 0 ? formatSlots(group.slots) : null,
      reason: group.reason ?? null,
    }));
  });

  /** Nothing is named until both dates are in: an empty form is not a mistake yet. */
  protected readonly issue = computed(() => {
    this.value();
    const value = this.form.getRawValue();
    return value.fromDate && value.toDate ? timeOffIssue(value, this.todayDate()) : null;
  });

  protected readonly canSave = computed(() => {
    this.value();
    return (
      !this.busy() &&
      this.form.valid &&
      timeOffIssue(this.form.getRawValue(), this.todayDate()) === null
    );
  });

  protected readonly conflict = computed(() => appointmentsConflict(this.refused()));

  protected readonly refusals = computed(() => {
    const error = this.refused();
    return error instanceof ApiError && error.code === MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE
      ? wordHoursRefusals(this.i18n, error)
      : [];
  });

  constructor() {
    // What was refused was another request: once the form changes, the refusal no longer describes it.
    this.form.valueChanges.subscribe(() => this.refused.set(null));
  }

  protected open(): void {
    this.form.reset();
    this.refused.set(null);
    this.removing.set(null);
    this.adding.set(true);
  }

  /** `confirmed` — the administrator has seen the Записи standing in the range. */
  protected submit(confirmed = false): void {
    if (!this.canSave()) {
      return;
    }
    const { auditReason, ...value } = this.form.getRawValue();
    this.busy.set(true);
    this.refused.set(null);
    this.create()({
      timeOff: { ...buildTimeOff(value), ...withAllowedAppointments(confirmed) },
      reason: auditReason.trim() || undefined,
    })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t('timeOff.created'),
            life: 4000,
          });
          this.adding.set(false);
          this.changed.emit(value.fromDate);
        },
        // Any other refusal has already been worded as a toast; the form stays as typed.
        error: (error: unknown) => this.refused.set(error),
      });
  }

  protected askToRemove(groupId: string): void {
    this.removeReason.reset();
    this.removing.set(groupId);
  }

  protected drop(groupId: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.remove()(groupId, this.removeReason.value.trim() || undefined)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.messages.add({
            severity: 'success',
            summary: this.i18n.t('timeOff.removed'),
            life: 4000,
          });
          this.removing.set(null);
          this.changed.emit(null);
        },
        // Already a toast. `NOT_FOUND` means somebody removed it first — then it is gone here too.
        error: (error: unknown) => {
          this.removing.set(null);
          if (error instanceof ApiError && error.code === 'NOT_FOUND') {
            this.changed.emit(null);
          }
        },
      });
  }
}
