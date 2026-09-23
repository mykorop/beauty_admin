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
    <div class="schedule-calendar max-w-5xl text-sm" data-testid="schedule-calendar">
      <div class="mb-3 flex flex-wrap items-center gap-2">
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
        <span class="calendar-note text-xs text-muted">{{ 'schedule.calendar.note' | t }}</span>
      </div>

      <div class="profile-table-scroll" tabindex="0" role="region" [attr.aria-label]="'schedule.calendar.title' | t">
      <div class="calendar-grid">
        @for (name of weekdays(); track $index) {
          <div class="bg-raised px-3 py-2 text-xs text-muted first-letter:uppercase">
            {{ name }}
          </div>
        }
        @for (day of days(); track day.date) {
          <div
            class="calendar-cell"
            data-testid="calendar-day"
            [class.outside-month]="!day.inMonth"
            [attr.data-date]="day.date"
            [attr.data-status]="day.status"
            [attr.title]="day.reason"
          >
            <div class="flex items-center justify-between">
              <span
                class="calendar-date text-xs"
                [class.is-today]="day.isToday"
                [attr.aria-current]="day.isToday ? 'date' : null"
                [attr.data-testid]="day.isToday ? 'calendar-today' : null"
                >{{ day.dayOfMonth }}</span
              >
              @if (day.appointments.active > 0) {
                <span
                  class="calendar-count"
                  data-testid="calendar-appointments"
                  [attr.title]="'schedule.calendar.appointments' | t: { count: day.appointments.active }"
                  >{{ day.appointments.active }}</span
                >
              }
            </div>
            <div class="mt-1 text-xs" data-testid="calendar-day-hours">{{ day.label }}</div>
            @if (day.reason) {
              <div class="mt-1 text-xs text-muted" data-testid="calendar-day-reason">
                {{ day.reason }}
              </div>
            }
            @if (day.appointments.cancelled > 0) {
              <div class="mt-1 text-xs text-muted" data-testid="calendar-cancelled">
                {{ 'schedule.calendar.cancelled' | t: { count: day.appointments.cancelled } }}
              </div>
            }
          </div>
        }
      </div>
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
