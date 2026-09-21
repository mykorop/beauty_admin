import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { catchError, EMPTY, forkJoin, map, Subject, switchMap, tap } from 'rxjs';
import type { DayHours, MasterSchedule, SchedulePattern } from '../../core/api/master-schedule.model';
import { SalonMastersClient } from '../../core/api/salon-masters.client';
import { SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { WEEK_ORDER, weekdayName } from '../../shared/weekday';
import { RotationSection, type RotationSaveRequest } from '../../shared/working-schedule/rotation.section';
import { monthOf, monthWindow, venueToday } from '../../shared/working-schedule/schedule-calendar';
import { ScheduleCalendar } from '../../shared/working-schedule/schedule-calendar.view';
import { TimeOffSection, type TimeOffCreateRequest } from '../../shared/working-schedule/time-off.section';
import { daysOutsideBounds, formatSlots, toWeekFormValue } from '../../shared/working-schedule/week-hours';
import { WeekHoursEditor, type WeekHoursSaveRequest } from '../../shared/working-schedule/week-hours.editor';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterStore } from './salon-master.store';

/**
 * Робочий графік of a Майстер салону: his тижневі години next to the Години роботи of his Салон —
 * so a mismatch shows at a glance — his Ротація, the month a Клієнт would meet, and the Відсутності
 * of that month. This tab is what knows about the Салон: the editor only gets the bounds to show,
 * the calendar only a schedule to draw, the two sections only the calls that write.
 */
@Component({
  selector: 'app-salon-master-schedule-tab',
  imports: [ButtonDirective, RotationSection, ScheduleCalendar, TimeOffSection, TranslatePipe, WeekHoursEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (schedule(); as schedule) {
      <h2 class="mb-3 font-medium">{{ 'schedule.week.title' | t }}</h2>
      @if (editing()) {
        <app-week-hours-editor
          savedMessage="schedule.week.saved"
          [stored]="schedule.weeklyHours"
          [bounds]="salonHours()"
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
              <th class="px-6 py-3 font-normal">{{ 'schedule.week.salon' | t }}</th>
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
                <td class="px-6 py-3 text-slate-500" data-testid="schedule-day-salon">
                  {{ day.salon ?? ((salonHoursSet() ? 'hours.closed' : 'hours.notSet') | t) }}
                </td>
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
        [bounds]="salonHours()"
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
export class SalonMasterScheduleTab {
  private readonly i18n = inject(I18nService);
  private readonly client = inject(SalonMastersClient);
  private readonly salonStore = inject(SalonCardStore);

  // The card renders its tabs only once the salon and the master are loaded, and rebuilds them for
  // another pair.
  private readonly salonId = this.salonStore.salon()?.salonId ?? '';
  private readonly masterId = inject(SalonMasterStore).master()?.masterId ?? '';

  /** The schedule over the grid of `month()` — the two always change together. */
  protected readonly schedule = signal<MasterSchedule | null>(null);
  protected readonly month = signal(monthOf(venueToday(this.salonStore.salon()?.timezone ?? 'UTC')));
  protected readonly salonHours = signal<DayHours[]>([]);
  protected readonly failed = signal(false);
  protected readonly editing = signal(false);
  protected readonly months = new Subject<string>();

  /** The backend refuses every write in a Видалений salon as well: `SALON_DELETED`. */
  protected readonly writable = computed(() => this.salonStore.salon()?.status !== 'deleted');
  /** A Салон that never stored its Години роботи bounds nothing — «не задано», not «зачинено». */
  protected readonly salonHoursSet = computed(() => this.salonHours().length > 0);

  protected readonly week = computed(() => {
    const locale = this.i18n.locale();
    const master = this.schedule()?.weeklyHours ?? [];
    const salon = this.salonHours();
    const outside = new Set(daysOutsideBounds(toWeekFormValue(master), salon));
    const windows = (days: readonly DayHours[], dayOfWeek: number) => {
      const day = days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
      return day?.isOpen && day.slots.length > 0 ? formatSlots(day.slots) : null;
    };
    return WEEK_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      name: weekdayName(locale, dayOfWeek),
      master: windows(master, dayOfWeek),
      salon: windows(salon, dayOfWeek),
      outside: outside.has(dayOfWeek),
    }));
  });

  protected readonly save = (request: WeekHoursSaveRequest) =>
    this.client.updateHours(this.salonId, this.masterId, request).pipe(map((hours) => hours.days));

  protected readonly saveRotation = (request: RotationSaveRequest) =>
    this.client
      .updateSchedulePattern(this.salonId, this.masterId, request)
      .pipe(map((stored) => stored.schedulePattern));

  protected readonly createTimeOff = (request: TimeOffCreateRequest) =>
    this.client.createTimeOff(this.salonId, this.masterId, request);

  protected readonly removeTimeOff = (groupId: string, reason?: string) =>
    this.client.removeTimeOff(this.salonId, this.masterId, groupId, reason);

  protected readonly monthOf = monthOf;

  constructor() {
    if (!this.salonId || !this.masterId) {
      return;
    }
    forkJoin({
      hours: inject(SalonsClient).hours(this.salonId),
      schedule: this.read(this.month()),
    })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ hours, schedule }) => {
          this.salonHours.set(hours.days);
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
    return this.client.schedule(this.salonId, this.masterId, monthWindow(month));
  }

  private show(month: string, schedule: MasterSchedule): void {
    this.month.set(month);
    this.schedule.set(schedule);
  }
}
