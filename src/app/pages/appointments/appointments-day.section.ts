import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgressBar } from 'primeng/progressbar';
import { distinctUntilChanged } from 'rxjs';
import {
  type AppointmentsDay,
  AppointmentsClient,
  type AppointmentsDayState,
  type AppointmentStatus,
} from '../../core/api/appointments.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatBuiltAt } from '../../shared/built-at';
import { TableRunFollower } from '../../shared/table-run';
import { PlatformAppointmentsTable } from './platform-appointments.table';

/**
 * Every Запис of one day of the platform.
 *
 * No index files Записи by day, so the backend answers «every Запис on the 23rd» only by reading the
 * whole table — never on a request, always in a worker, the Детальна статистика's own machinery
 * (ADR-0003). So this is that dashboard section's shape rather than a table's: a button that starts
 * the gathering, a bar that follows it, and the last list the day was gathered into, dated by when
 * the table was read. A day gathered before opens at once; one never gathered says so and waits for
 * the button.
 *
 * The status filter cuts the gathered day in the browser — the whole day is already here, and a
 * second full read of the table to drop the rows this one has would be the costliest filter there is.
 */
@Component({
  selector: 'app-appointments-day',
  imports: [Button, Message, PlatformAppointmentsTable, ProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section data-testid="appointments-day">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <p class="max-w-3xl text-sm text-slate-600">{{ 'platformAppointments.day.hint' | t }}</p>
        <span class="flex-1"></span>
        @if (builtAt(); as builtAt) {
          <span class="text-sm text-slate-600" data-testid="appointments-day-built-at">{{
            'platformAppointments.day.builtAt' | t: { time: builtAt }
          }}</span>
        }
        <p-button
          data-testid="appointments-day-run"
          icon="pi pi-refresh"
          size="small"
          [label]="
            (result() ? 'platformAppointments.day.rerun' : 'platformAppointments.day.run') | t
          "
          [loading]="runs.busy()"
          (onClick)="runs.start()"
        />
      </div>

      @if (runs.running()) {
        <div class="mb-4 max-w-xl" data-testid="appointments-day-progress">
          <p-progressbar
            styleClass="h-2"
            [mode]="runs.progress() === null ? 'indeterminate' : 'determinate'"
            [value]="runs.progress() ?? 0"
            [showValue]="false"
          />
          <p class="mt-1 text-sm text-slate-600">{{ progressText() }}</p>
        </div>
      }

      @if (failureKey(); as failureKey) {
        <p-message class="mb-4 block" severity="warn" data-testid="appointments-day-failed">
          {{ failureKey | t }}
          @if (result()) {
            {{ 'platformAppointments.day.previousResult' | t }}
          }
        </p-message>
      }

      @if (runs.followFailed()) {
        <p-message class="mb-4 block" severity="warn" data-testid="appointments-day-follow-failed">
          {{ 'platformAppointments.day.followFailed' | t }}
        </p-message>
      }

      @if (runs.loadFailed() && !result()) {
        <p class="text-slate-600" data-testid="appointments-day-load-failed">
          {{ 'platformAppointments.day.loadFailed' | t }}
        </p>
      }

      @if (neverGathered()) {
        <p class="text-slate-600" data-testid="appointments-day-never">
          {{ 'platformAppointments.day.never' | t }}
        </p>
      }

      @if (rows(); as rows) {
        <div class="transition-opacity" [class.opacity-60]="runs.running()">
          <app-platform-appointments-table
            [appointments]="rows"
            emptyKey="platformAppointments.day.empty"
          />
        </div>
      }
    </section>
  `,
})
export class AppointmentsDaySection {
  /** The day of the platform's calendar, `YYYY-MM-DD`. */
  readonly date = input.required<string>();
  readonly status = input<AppointmentStatus | null>(null);

  private readonly client = inject(AppointmentsClient);
  private readonly i18n = inject(I18nService);

  /** The day's last gathering and its last list, read for each day and followed while it reads. */
  protected readonly runs = new TableRunFollower<AppointmentsDayState>({
    read: () => this.client.day(this.date()),
    start: () => this.client.startDay(this.date()),
  });

  /**
   * The list as the last gathering left it — the same list for as long as it is the same
   * gathering. Every poll of a new one answers with the previous list again, and a list that
   * changed identity each time would close the Запис the administrator has open under it.
   */
  protected readonly result = computed<AppointmentsDay | null>(
    () => this.runs.state()?.result ?? null,
    { equal: (left, right) => left?.runId === right?.runId },
  );
  protected readonly neverGathered = computed(
    () => this.runs.state() !== null && !this.runs.run() && !this.result(),
  );

  protected readonly rows = computed(() => {
    const result = this.result();
    const status = this.status();
    return result ? result.items.filter((item) => !status || item.status === status) : null;
  });

  protected readonly progressText = computed(() => {
    const run = this.runs.run();
    if (!run) {
      return '';
    }
    const count = new Intl.NumberFormat(this.i18n.locale());
    return run.estimatedItems
      ? this.i18n.t('platformAppointments.day.progress', {
          scanned: count.format(run.scannedItems),
          estimated: count.format(run.estimatedItems),
        })
      : this.i18n.t('platformAppointments.day.progressCount', {
          scanned: count.format(run.scannedItems),
        });
  });

  protected readonly failureKey = computed(() => {
    const run = this.runs.run();
    return run?.status === 'failed'
      ? (`platformAppointments.day.failed.${run.errorCode ?? 'FAILED'}` as TranslationKey)
      : null;
  });

  protected readonly builtAt = computed(() =>
    formatBuiltAt(this.result()?.builtAt, this.i18n.locale()),
  );

  constructor() {
    // Another day is another question: whatever was read or followed for the last one is dropped
    // with its answer.
    toObservable(this.date)
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.runs.load());
  }
}
