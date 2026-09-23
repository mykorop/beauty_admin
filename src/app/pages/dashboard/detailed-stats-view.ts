import type {
  AppointmentsDay,
  AppointmentValueDay,
  DetailedStatsRun,
  GrowthDay,
} from '../../core/api/stats.client';
import { addCalendarDays } from '../../shared/calendar-day';

/**
 * How far back the charts look. The backend sends the whole history day by day; the period is only
 * which part of it is drawn, so switching it asks nothing of the backend.
 */
export const STATS_PERIODS = ['30', '90', '365', 'all'] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/** The first day a period draws — today being its last — or `null` for the whole history. */
export function periodStart(today: string, period: StatsPeriod): string | null {
  return period === 'all' ? null : addCalendarDays(today, 1 - Number(period));
}

/**
 * The days from `start` on. Everything after today stays: Записи booked ahead belong to every
 * period, since «what is already booked» does not depend on how far back one looks.
 */
export function daysFrom<T extends { day: string }>(
  series: readonly T[],
  start: string | null,
): T[] {
  return start === null ? [...series] : series.filter(({ day }) => day >= start);
}

/**
 * The weeks from the one `start` falls in on — that week whole, since a week cut to the days inside
 * the period would read as a dip in registrations that never happened.
 */
export function weeksFrom<T extends { day: string }>(
  weeks: readonly T[],
  start: string | null,
): T[] {
  return start === null ? [...weeks] : weeks.filter(({ day }) => addCalendarDays(day, 6) >= start);
}

export function growthTotals(days: readonly GrowthDay[]): Omit<GrowthDay, 'day'> {
  return days.reduce(
    (totals, day) => ({
      salons: totals.salons + day.salons,
      masters: totals.masters + day.masters,
      clients: totals.clients + day.clients,
    }),
    { salons: 0, masters: 0, clients: 0 },
  );
}

export type AppointmentTotals = Omit<AppointmentsDay, 'day'> & {
  total: number;
  /**
   * Cancelled among the Записи due up to and including `today`, `0`–`1`; `null` when none are due.
   * Days ahead are left out of it: their cancellations have not happened yet, and counting their
   * bookings would read as a platform where nobody ever cancels.
   */
  cancellationShare: number | null;
};

/** The period's Записи by state — days booked ahead included — and its share of cancellations. */
export function appointmentTotals(
  days: readonly AppointmentsDay[],
  today: string,
): AppointmentTotals {
  const sums = { upcoming: 0, pastBooked: 0, completed: 0, cancelled: 0, noShow: 0 };
  let due = 0;
  let dueCancelled = 0;
  for (const day of days) {
    sums.upcoming += day.upcoming;
    sums.pastBooked += day.pastBooked;
    sums.completed += day.completed;
    sums.cancelled += day.cancelled;
    sums.noShow += day.noShow;
    if (day.day <= today) {
      due += day.upcoming + day.pastBooked + day.completed + day.cancelled + day.noShow;
      dueCancelled += day.cancelled;
    }
  }
  const total = sums.upcoming + sums.pastBooked + sums.completed + sums.cancelled + sums.noShow;
  return { ...sums, total, cancellationShare: due === 0 ? null : dueCancelled / due };
}

/** Вартість Записів of the period, added up in cents so that 0.1 and 0.2 make 0.3. */
export function valueTotals(days: readonly AppointmentValueDay[]): { past: number; ahead: number } {
  let past = 0;
  let ahead = 0;
  for (const day of days) {
    past += Math.round(day.past * 100);
    ahead += Math.round(day.ahead * 100);
  }
  return { past: past / 100, ahead: ahead / 100 };
}

/**
 * How far a run has got, as a percentage of the table — or `null` when there is no estimate to take
 * it of, and the dashboard shows the count alone. DynamoDB refreshes its estimate every few hours,
 * so the count can outrun it: a run still reading is at most 99%, never «done».
 */
export function runProgress(run: DetailedStatsRun): number | null {
  if (!run.estimatedItems) {
    return null;
  }
  return Math.min(99, Math.floor((run.scannedItems / run.estimatedItems) * 100));
}
