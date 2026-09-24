import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { catchError, EMPTY, forkJoin, map, Subject, switchMap, tap } from 'rxjs';
import type { DayHours, MasterSchedule, SchedulePattern } from '../../core/api/master-schedule.model';
import { WorkingScheduleClient } from '../../core/api/working-schedule.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { cardScope } from '../profile-card/loaded-card';
import { WEEK_ORDER, weekdayName } from '../weekday';
import { RotationSection, type RotationSaveRequest } from './rotation.section';
import { venueToday } from '../venue-date';
import { monthOf, monthWindow } from './schedule-calendar';
import { ScheduleCalendar } from './schedule-calendar.view';
import { TimeOffSection, type TimeOffCreateRequest } from './time-off.section';
import { daysOutsideBounds, formatSlots, toWeekFormValue } from './week-hours';
import { WeekHoursEditor, type WeekHoursSaveRequest } from './week-hours.editor';

/**
 * Робочий графік of a Майстер: his тижневі години — next to the Години роботи of his Салон where
 * there are any, so a mismatch shows at a glance — his Ротація, the month a Клієнт would meet, and
 * the Відсутності of that month.
 *
 * Whose calendar this is, and whether a Салон bounds it, is the card's scope. The bounds are the
 * whole difference between a Майстер салону and a Незалежний майстер: a roster master works inside
 * the Години роботи of his Салон (`domain.md` §1d), so the week is shown next to them and a day that
 * sticks out is marked; a Незалежний майстер answers to no salon week, so the column, the warning and
 * the read that fetched them are all absent. The editor only gets the bounds to show, the calendar
 * only a schedule to draw, the two sections only the calls that write — never in a Видалений
 * profile, where the backend refuses every write as well.
 */
@Component({
  selector: 'app-working-schedule',
  imports: [ButtonDirective, RotationSection, ScheduleCalendar, TimeOffSection, TranslatePipe, WeekHoursEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (schedule(); as schedule) {
      <h2 class="mb-3 font-medium">{{ 'schedule.week.title' | t }}</h2>
      @if (editing()) {
        <app-week-hours-editor
          savedMessage="schedule.week.saved"
          [stored]="schedule.weeklyHours"
          [bounds]="bounds()"
          [save]="save"
          (saved)="weekSaved($event)"
          (closed)="editing.set(false)"
        />
      } @else {
        @if (writable()) {
          <div class="mb-3 flex max-w-2xl justify-end">
            <button
              pButton
              type="button"
              size="small"
              icon="pi pi-pencil"
              data-testid="hours-edit"
              [label]="'hours.edit.open' | t"
              (click)="editing.set(true)"
            ></button>
          </div>
        }
        <div class="profile-table-scroll max-w-2xl" tabindex="0" role="region" [attr.aria-label]="'schedule.week.title' | t"><table class="schedule-week-table">
          <thead class="text-xs text-muted">
            <tr class="border-b border-divider">
              <th class="px-6 py-3 font-normal"></th>
              <th class="px-6 py-3 font-normal">{{ 'schedule.week.master' | t }}</th>
              @if (bounded()) {
                <th class="px-6 py-3 font-normal">{{ 'schedule.week.salon' | t }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (day of week(); track day.dayOfWeek) {
              <tr class="border-b border-divider last:border-0" data-testid="schedule-day">
                <th class="w-40 px-6 py-3 font-medium first-letter:uppercase">{{ day.name }}</th>
                <td class="px-6 py-3" data-testid="schedule-day-master" [class.text-muted]="!day.master">
                  {{ day.master ?? ('schedule.week.dayOff' | t) }}
                  @if (day.outside) {
                    <span class="ml-2 text-xs text-warning" data-testid="schedule-day-outside">
                      {{ 'hours.edit.outsideBounds' | t }}
                    </span>
                  }
                </td>
                @if (bounded()) {
                  <td class="px-6 py-3 text-muted" data-testid="schedule-day-salon">
                    {{ day.salon ?? ((boundsSet() ? 'hours.closed' : 'hours.notSet') | t) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table></div>
      }

      <h2 class="mb-3 mt-8 font-medium">{{ 'rotation.title' | t }}</h2>
      <app-rotation-section
        [pattern]="schedule.schedulePattern"
        [todayDate]="schedule.todayDate"
        [writable]="writable()"
        [save]="saveRotation"
        (saved)="rotationSaved($event)"
      />

      <h2 class="mb-3 mt-8 font-medium">{{ 'schedule.calendar.title' | t }}</h2>
      <app-schedule-calendar
        [month]="month()"
        [schedule]="schedule"
        [bounds]="bounds()"
        (monthChange)="months.next($event)"
      />

      <h2 class="mb-1 mt-8 font-medium">{{ 'timeOff.title' | t }}</h2>
      <p class="mb-3 text-xs text-muted">{{ 'timeOff.note' | t }}</p>
      <app-time-off-section
        [groups]="schedule.timeOff"
        [todayDate]="schedule.todayDate"
        [writable]="writable()"
        [create]="createTimeOff"
        [remove]="removeTimeOff"
        (changed)="months.next($event ? monthOf($event) : month())"
      />
    } @else if (failed()) {
      <p class="text-muted" data-testid="schedule-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class WorkingScheduleTab {
  private readonly i18n = inject(I18nService);
  private readonly client = inject(WorkingScheduleClient);
  private readonly scope = cardScope();

  /** The schedule over the grid of `month()` — the two always change together. */
  protected readonly schedule = signal<MasterSchedule | null>(null);
  protected readonly month = signal('');
  protected readonly bounds = signal<DayHours[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly editing = signal(false);
  protected readonly months = new Subject<string>();

  protected readonly writable = computed(() => this.scope().writable);
  /** A week nothing bounds shows one column and marks no day as sticking out. */
  protected readonly bounded = computed(() => this.bounds() !== null);
  /** Bounds that were never stored bound nothing — «не задано», not «зачинено». */
  protected readonly boundsSet = computed(() => (this.bounds()?.length ?? 0) > 0);

  protected readonly week = computed(() => {
    const locale = this.i18n.locale();
    const master = this.schedule()?.weeklyHours ?? [];
    const bounds = this.bounds();
    const outside = new Set(daysOutsideBounds(toWeekFormValue(master), bounds));
    const windows = (days: readonly DayHours[], dayOfWeek: number) => {
      const day = days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
      return day?.isOpen && day.slots.length > 0 ? formatSlots(day.slots) : null;
    };
    return WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      name: weekdayName(locale, dayOfWeek),
      master: windows(master, dayOfWeek),
      salon: windows(bounds ?? [], dayOfWeek),
      outside: outside.has(dayOfWeek),
    }));
  });

  protected readonly save = (request: WeekHoursSaveRequest) =>
    this.client.updateHours(this.scope(), request).pipe(map((hours) => hours.days));

  protected readonly saveRotation = (request: RotationSaveRequest) =>
    this.client
      .updateSchedulePattern(this.scope(), request)
      .pipe(map((stored) => stored.schedulePattern));

  protected readonly createTimeOff = (request: TimeOffCreateRequest) =>
    this.client.createTimeOff(this.scope(), request);

  protected readonly removeTimeOff = (groupId: string, reason?: string) =>
    this.client.removeTimeOff(this.scope(), groupId, reason);

  protected readonly monthOf = monthOf;

  constructor() {
    const scope = this.scope();
    this.month.set(monthOf(venueToday(scope.timezone)));

    forkJoin({ bounds: this.client.bounds(scope), schedule: this.read(this.month()) })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ bounds, schedule }) => {
          this.bounds.set(bounds);
          this.schedule.set(schedule);
        },
        // The interceptor has already worded the refusal as a toast.
        error: () => this.failed.set(true),
      });

    // Another month: the shown one stays until the asked one is read, and a refused read keeps it.
    this.months
      .pipe(
        switchMap((month) =>
          this.read(month).pipe(
            tap((schedule) => this.show(month, schedule)),
            // Already a toast; the next month asked for still has to be read.
            catchError(() => EMPTY),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** The saved week changes what the calendar shows, without another read. */
  protected weekSaved(weeklyHours: DayHours[]): void {
    this.schedule.update((schedule) => schedule && { ...schedule, weeklyHours });
  }

  /** Like the week: the stored Ротація redraws the calendar without another read. */
  protected rotationSaved(schedulePattern: SchedulePattern | null): void {
    this.schedule.update((schedule) => schedule && { ...schedule, schedulePattern });
  }

  private read(month: string) {
    return this.client.read(this.scope(), monthWindow(month));
  }

  private show(month: string, schedule: MasterSchedule): void {
    this.month.set(month);
    this.schedule.set(schedule);
  }
}

