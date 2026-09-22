import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { catchError, EMPTY, forkJoin, type Observable, of, Subject, switchMap, tap } from 'rxjs';
import type { DayHours, MasterSchedule, SchedulePattern } from '../../core/api/master-schedule.model';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { WEEK_ORDER, weekdayName } from '../weekday';
import { RotationSection, type RotationSaveRequest } from './rotation.section';
import { monthOf, monthWindow, venueToday } from './schedule-calendar';
import { ScheduleCalendar } from './schedule-calendar.view';
import { TimeOffSection, type TimeOffCreateRequest } from './time-off.section';
import { daysOutsideBounds, formatSlots, toWeekFormValue } from './week-hours';
import { WeekHoursEditor, type WeekHoursSaveRequest } from './week-hours.editor';

/**
 * Everything the Робочий графік tab does, bound to whose calendar it is.
 *
 * `bounds` is the whole difference between a Майстер салону and a Незалежний майстер: a roster
 * master works inside the Години роботи of his Салон (`domain.md` §1d), so the week is shown next
 * to them and a day that sticks out is marked; a Незалежний майстер answers to no salon week, so
 * `bounds: null` drops the column, the warning and the read that fetched them.
 */
export type WorkingSchedulePort = {
  /** The venue's clock, used only to pick the month the tab opens on. */
  timezone: string;
  /** A Видалений profile is read-only: the backend refuses every write here as well. */
  writable: boolean;
  read(window: { from: string; to: string }): Observable<MasterSchedule>;
  /** The Години роботи this week has to stay inside, or `null` when nothing bounds it. */
  bounds: Observable<DayHours[]> | null;
  saveWeek(request: WeekHoursSaveRequest): Observable<DayHours[]>;
  saveRotation(request: RotationSaveRequest): Observable<SchedulePattern | null>;
  createTimeOff(request: TimeOffCreateRequest): Observable<unknown>;
  removeTimeOff(groupId: string, reason?: string): Observable<unknown>;
};

/**
 * Робочий графік of a Майстер: his тижневі години — next to the Години роботи of his Салон where
 * there are any, so a mismatch shows at a glance — his Ротація, the month a Клієнт would meet, and
 * the Відсутності of that month.
 *
 * It knows neither whose calendar this is nor whether he works in a Салон: the `port` answers both.
 * The editor only gets the bounds to show, the calendar only a schedule to draw, the two sections
 * only the calls that write.
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
        <table class="w-full max-w-2xl rounded-lg border border-slate-200 bg-white text-left text-sm">
          <thead class="text-xs text-slate-500">
            <tr class="border-b border-slate-200">
              <th class="px-6 py-3 font-normal"></th>
              <th class="px-6 py-3 font-normal">{{ 'schedule.week.master' | t }}</th>
              @if (bounded()) {
                <th class="px-6 py-3 font-normal">{{ 'schedule.week.salon' | t }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (day of week(); track day.dayOfWeek) {
              <tr class="border-b border-slate-100 last:border-0" data-testid="schedule-day">
                <th class="w-40 px-6 py-3 font-medium first-letter:uppercase">{{ day.name }}</th>
                <td class="px-6 py-3" data-testid="schedule-day-master" [class.text-slate-500]="!day.master">
                  {{ day.master ?? ('schedule.week.dayOff' | t) }}
                  @if (day.outside) {
                    <span class="ml-2 text-xs text-amber-700" data-testid="schedule-day-outside">
                      {{ 'hours.edit.outsideBounds' | t }}
                    </span>
                  }
                </td>
                @if (bounded()) {
                  <td class="px-6 py-3 text-slate-500" data-testid="schedule-day-salon">
                    {{ day.salon ?? ((boundsSet() ? 'hours.closed' : 'hours.notSet') | t) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
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
      <p class="mb-3 text-xs text-slate-500">{{ 'timeOff.note' | t }}</p>
      <app-time-off-section
        [groups]="schedule.timeOff"
        [todayDate]="schedule.todayDate"
        [writable]="writable()"
        [create]="createTimeOff"
        [remove]="removeTimeOff"
        (changed)="months.next($event ? monthOf($event) : month())"
      />
    } @else if (failed()) {
      <p class="text-slate-600" data-testid="schedule-failed">{{ 'card.failed' | t }}</p>
    }
  `,
})
export class WorkingScheduleTab implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Whose Робочий графік this is — every read and every write goes through it. */
  readonly port = input.required<WorkingSchedulePort>();

  /** The schedule over the grid of `month()` — the two always change together. */
  protected readonly schedule = signal<MasterSchedule | null>(null);
  protected readonly month = signal('');
  protected readonly bounds = signal<DayHours[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly editing = signal(false);
  protected readonly months = new Subject<string>();

  protected readonly writable = computed(() => this.port().writable);
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

  protected readonly save = (request: WeekHoursSaveRequest) => this.port().saveWeek(request);

  protected readonly saveRotation = (request: RotationSaveRequest) => this.port().saveRotation(request);

  protected readonly createTimeOff = (request: TimeOffCreateRequest) => this.port().createTimeOff(request);

  protected readonly removeTimeOff = (groupId: string, reason?: string) => this.port().removeTimeOff(groupId, reason);

  protected readonly monthOf = monthOf;

  // `port` is an input, so the first read waits for the bindings — not the constructor.
  ngOnInit(): void {
    const port = this.port();
    this.month.set(monthOf(venueToday(port.timezone)));

    forkJoin({ bounds: port.bounds ?? of(null), schedule: this.read(this.month()) })
      .pipe(takeUntilDestroyed(this.destroyRef))
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
        takeUntilDestroyed(this.destroyRef),
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
    return this.port().read(monthWindow(month));
  }

  private show(month: string, schedule: MasterSchedule): void {
    this.month.set(month);
    this.schedule.set(schedule);
  }
}

/** Re-exported so a tab building a port imports the three request shapes from one place. */
export type { RotationSaveRequest, TimeOffCreateRequest, WeekHoursSaveRequest };
