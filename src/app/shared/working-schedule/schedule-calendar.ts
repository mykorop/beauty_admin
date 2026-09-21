import type {
  DayHours,
  MasterSchedule,
  SchedulePattern,
  TimeOffGroup,
  TimeSlot,
} from '../../core/api/master-schedule.model';

/**
 * Why a day is or is not bookable — the backend's own `WorkingDayStatus` (`resolveWorkingDay`), so
 * the calendar shows what a Клієнт would get and names the same reason the domain would. Plus
 * `BOUNDS_CLOSED`: a day the Майстер works and his Салон does not, where a Клієнт finds no slot.
 */
export type CalendarDayStatus =
  'OPEN' | 'CLOSED' | 'DAY_OFF' | 'BLOCKED' | 'CUSTOM_HOURS' | 'PATTERN_OFF' | 'BOUNDS_CLOSED';

export type CalendarDay = {
  /** `YYYY-MM-DD` on the venue's calendar. */
  date: string;
  dayOfMonth: number;
  /** A day of a neighbouring month that only fills the week. */
  inMonth: boolean;
  isToday: boolean;
  status: CalendarDayStatus;
  /** The windows a Клієнт can book in; empty on any day that is not worked. */
  slots: TimeSlot[];
  /** The reason of the Відсутність that settled the day, when it has one. */
  reason: string | null;
  appointments: { active: number; cancelled: number };
};

const DAY_MS = 86_400_000;

const toUtc = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const toDate = (utc: number): string => new Date(utc).toISOString().slice(0, 10);
const addDays = (date: string, days: number): string => toDate(toUtc(date) + days * DAY_MS);
const weekday = (date: string): number => new Date(toUtc(date)).getUTCDay();
/** Days back to the Monday that opens the week of `date`. */
const sinceMonday = (date: string): number => (weekday(date) + 6) % 7;

/** `YYYY-MM` of a calendar date. */
export const monthOf = (date: string): string => date.slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + by, 1)).toISOString().slice(0, 7);
}

/** The dates the grid of `month` shows: whole weeks, Monday first. This is the window to read. */
export function monthWindow(month: string): { from: string; to: string } {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  return { from: addDays(first, -sinceMonday(first)), to: addDays(last, 6 - sinceMonday(last)) };
}

/**
 * Mirror of the backend's `isCycleWorkingDate`: a Ротація that cannot be read is treated as absent
 * rather than as closing every day.
 */
function isCycleWorkingDate(pattern: SchedulePattern, date: string): boolean {
  const { anchorDate, cycleLength } = pattern;
  if (Number.isNaN(toUtc(anchorDate)) || !Number.isInteger(cycleLength) || cycleLength < 1) {
    return true;
  }
  const offsets = (pattern.workingOffsets ?? []).filter(
    (offset) => Number.isInteger(offset) && offset >= 0 && offset < cycleLength,
  );
  if (offsets.length === 0) {
    return true;
  }
  const days = Math.round((toUtc(date) - toUtc(anchorDate)) / DAY_MS);
  // Double modulo: a date before the anchor must land on a position too.
  return offsets.includes(((days % cycleLength) + cycleLength) % cycleLength);
}

const covers = (group: TimeOffGroup, date: string): boolean =>
  group.fromDate <= date && date <= group.toDate && !group.skippedDates?.includes(date);

/** Mirror of the backend's `resolveWorkingDay`: the Відсутність first, then the week, then the Ротація. */
function resolveDay(schedule: MasterSchedule, date: string): Pick<CalendarDay, 'status' | 'slots' | 'reason'> {
  const absence = schedule.timeOff.find((group) => covers(group, date));
  const reason = absence?.reason ?? null;
  if (absence?.type === 'DAY_OFF' || absence?.type === 'BLOCKED') {
    return { status: absence.type, slots: [], reason };
  }
  if (absence?.type === 'CUSTOM_HOURS') {
    return absence.slots.length > 0
      ? { status: 'CUSTOM_HOURS', slots: absence.slots, reason }
      : { status: 'CLOSED', slots: [], reason };
  }
  const day = schedule.weeklyHours.find((candidate) => candidate.dayOfWeek === weekday(date));
  if (!day?.isOpen || day.slots.length === 0) {
    return { status: 'CLOSED', slots: [], reason: null };
  }
  if (schedule.schedulePattern && !isCycleWorkingDate(schedule.schedulePattern, date)) {
    return { status: 'PATTERN_OFF', slots: [], reason: null };
  }
  return { status: 'OPEN', slots: day.slots, reason: null };
}

/**
 * What the bounds leave of a worked day — client-api trims a Майстер салону to the Години роботи of
 * his Салон on every availability read (`intersectTimeSlots`). Bounds never stored hold nothing.
 */
function withinBounds(
  day: Pick<CalendarDay, 'status' | 'slots' | 'reason'>,
  bounds: readonly DayHours[] | null,
  dayOfWeek: number,
): Pick<CalendarDay, 'status' | 'slots' | 'reason'> {
  if (!bounds?.length || day.slots.length === 0) {
    return day;
  }
  const bound = bounds.find((candidate) => candidate.dayOfWeek === dayOfWeek);
  const allowed = bound?.isOpen ? bound.slots : [];
  const slots = day.slots.flatMap((slot) =>
    allowed.flatMap((window) => {
      const start = slot.start > window.start ? slot.start : window.start;
      const end = slot.end < window.end ? slot.end : window.end;
      return start < end ? [{ start, end }] : [];
    }),
  );
  return slots.length > 0 ? { ...day, slots } : { ...day, status: 'BOUNDS_CLOSED', slots: [] };
}

/** The calendar date of an instant on the venue's clock; the browser's zone would shift late evenings. */
function venueDate(iso: string, timeZone: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  try {
    // `en-CA` writes a date as `YYYY-MM-DD`.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

/** Today on the venue's clock — the month a calendar opens on before any schedule is read. */
export function venueToday(timeZone: string, now = new Date()): string {
  return venueDate(now.toISOString(), timeZone) ?? now.toISOString().slice(0, 10);
}

/**
 * The month as a Клієнт would meet it: for every day of the grid, whether the Майстер can be booked
 * and in which windows, plus the Записи already standing on it. `bounds` is the week the Майстер
 * is trimmed to — the Години роботи of his Салон; a Незалежний майстер has none.
 */
export function buildMonthCalendar(
  month: string,
  schedule: MasterSchedule,
  bounds: readonly DayHours[] | null = null,
): CalendarDay[][] {
  const appointments = new Map<string, { active: number; cancelled: number }>();
  for (const appointment of schedule.appointments) {
    const date = venueDate(appointment.startTime, schedule.timezone);
    if (date) {
      const counts = appointments.get(date) ?? { active: 0, cancelled: 0 };
      counts[appointment.status === 'CANCELLED' ? 'cancelled' : 'active'] += 1;
      appointments.set(date, counts);
    }
  }

  const { from, to } = monthWindow(month);
  const weeks: CalendarDay[][] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (weekday(date) === 1) {
      weeks.push([]);
    }
    weeks[weeks.length - 1].push({
      date,
      dayOfMonth: Number(date.slice(8)),
      inMonth: monthOf(date) === month,
      isToday: date === schedule.todayDate,
      ...withinBounds(resolveDay(schedule, date), bounds, weekday(date)),
      appointments: appointments.get(date) ?? { active: 0, cancelled: 0 },
    });
  }
  return weeks;
}
