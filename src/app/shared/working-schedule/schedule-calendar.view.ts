import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import type { DayHours, MasterSchedule } from '../../core/api/master-schedule.model';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { WEEK_ORDER } from '../weekday';
import { buildMonthCalendar, type CalendarDayStatus, shiftMonth } from './schedule-calendar';
import { formatSlots } from './week-hours';

/** Why a day cannot be booked, in words; a worked day shows its windows instead. */
const STATUS_KEYS: Record<Exclude<CalendarDayStatus, 'OPEN' | 'CUSTOM_HOURS'>, TranslationKey> = {
  CLOSED: 'schedule.calendar.closed',
  DAY_OFF: 'schedule.calendar.dayOff',
  BLOCKED: 'schedule.calendar.blocked',
  PATTERN_OFF: 'schedule.calendar.patternOff',
  BOUNDS_CLOSED: 'schedule.calendar.boundsClosed',
};

const STATUS_CLASSES: Record<CalendarDayStatus, string> = {
  OPEN: 'bg-white',
  CUSTOM_HOURS: 'bg-sky-50',
  CLOSED: 'bg-slate-50 text-slate-400',
  PATTERN_OFF: 'bg-slate-50 text-slate-400',
  DAY_OFF: 'bg-amber-50',
  BLOCKED: 'bg-amber-50',
  BOUNDS_CLOSED: 'bg-amber-50',
};

/**
 * One month of a Робочий графік as a Клієнт would meet it: on which days the Майстер can be booked
 * and in which windows, why not on the others, and the Записи already standing. It draws whatever
 * schedule it is handed and asks its host for another month — it reads nothing itself and does not
 * know whether the Майстер works in a Салон.
 */
@Component({
  selector: 'app-schedule-calendar',
  imports: [ButtonDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-5xl text-sm" data-testid="schedule-calendar">
      <div class="mb-3 flex items-center gap-2">
        <button
          pButton
          type="button"
          size="small"
          severity="secondary"
          icon="pi pi-chevron-left"
          data-testid="calendar-prev"
          [text]="true"
          [attr.aria-label]="'schedule.calendar.prev' | t"
          (click)="monthChange.emit(shift(-1))"
        ></button>
        <h3 class="w-44 text-center font-medium first-letter:uppercase" data-testid="calendar-month">
          {{ title() }}
        </h3>
        <button
          pButton
          type="button"
          size="small"
          severity="secondary"
          icon="pi pi-chevron-right"
          data-testid="calendar-next"
          [text]="true"
          [attr.aria-label]="'schedule.calendar.next' | t"
          (click)="monthChange.emit(shift(1))"
        ></button>
        <span class="ml-auto text-xs text-slate-500">{{ 'schedule.calendar.note' | t }}</span>
      </div>

      <div class="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-slate-200 gap-px">
        @for (name of weekdays(); track $index) {
          <div class="bg-slate-50 px-2 py-1 text-xs text-slate-500 first-letter:uppercase">
            {{ name }}
          </div>
        }
        @for (day of days(); track day.date) {
          <div
            class="min-h-24 px-2 py-1"
            data-testid="calendar-day"
            [class]="day.classes"
            [class.opacity-50]="!day.inMonth"
            [attr.data-date]="day.date"
            [attr.data-status]="day.status"
            [attr.title]="day.reason"
          >
            <div class="flex items-center justify-between">
              <span
                class="text-xs"
                [class.font-semibold]="day.isToday"
                [class.text-sky-700]="day.isToday"
                [attr.data-testid]="day.isToday ? 'calendar-today' : null"
                >{{ day.dayOfMonth }}</span
              >
              @if (day.appointments.active > 0) {
                <span
                  class="rounded-full bg-sky-100 px-2 text-xs text-sky-800"
                  data-testid="calendar-appointments"
                  [attr.title]="'schedule.calendar.appointments' | t: { count: day.appointments.active }"
                  >{{ day.appointments.active }}</span
                >
              }
            </div>
            <div class="mt-1 text-xs" data-testid="calendar-day-hours">{{ day.label }}</div>
            @if (day.reason) {
              <div class="truncate text-xs text-slate-500" data-testid="calendar-day-reason">
                {{ day.reason }}
              </div>
            }
            @if (day.appointments.cancelled > 0) {
              <div class="text-xs text-slate-400" data-testid="calendar-cancelled">
                {{ 'schedule.calendar.cancelled' | t: { count: day.appointments.cancelled } }}
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ScheduleCalendar {
  private readonly i18n = inject(I18nService);

  /** `YYYY-MM`. */
  readonly month = input.required<string>();
  /** The schedule over the grid of `month` (`monthWindow`). */
  readonly schedule = input.required<MasterSchedule>();
  /** The week the Майстер is trimmed to for a Клієнт — the Години роботи of his Салон. `null`: none. */
  readonly bounds = input<DayHours[] | null>(null);

  /** The month the administrator asked for; the host reads its schedule and hands both back. */
  readonly monthChange = output<string>();

  protected readonly title = computed(() =>
    new Intl.DateTimeFormat(this.i18n.locale(), {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${this.month()}-01T00:00:00Z`)),
  );

  protected readonly weekdays = computed(() => {
    const format = new Intl.DateTimeFormat(this.i18n.locale(), {
      weekday: 'short',
      timeZone: 'UTC',
    });
    // 2024-01-07 was a Sunday, so day `n` of that week names `dayOfWeek = n`.
    return WEEK_ORDER.map((dayOfWeek) => format.format(new Date(Date.UTC(2024, 0, 7 + dayOfWeek))));
  });

  protected readonly days = computed(() =>
    buildMonthCalendar(this.month(), this.schedule(), this.bounds())
      .flat()
      .map((day) => ({
        ...day,
        classes: STATUS_CLASSES[day.status],
        label:
          day.status === 'OPEN'
            ? formatSlots(day.slots)
            : day.status === 'CUSTOM_HOURS'
              ? this.i18n.t('schedule.calendar.customHours', { slots: formatSlots(day.slots) })
              : this.i18n.t(STATUS_KEYS[day.status]),
      })),
  );

  protected shift(by: number): string {
    return shiftMonth(this.month(), by);
  }
}
