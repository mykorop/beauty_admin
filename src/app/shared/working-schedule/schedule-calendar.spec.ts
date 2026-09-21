import { buildMonthCalendar, monthOf, monthWindow, shiftMonth, type CalendarDay } from './schedule-calendar';
import type { MasterSchedule } from '../../core/api/master-schedule.model';

const WINDOW = [{ start: '09:00', end: '18:00' }];

/** Mon–Fri 09–18; October 2026 starts on a Thursday. */
const schedule = (overrides: Partial<MasterSchedule> = {}): MasterSchedule => ({
  weeklyHours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) =>
    dayOfWeek === 0 || dayOfWeek === 6
      ? { dayOfWeek, isOpen: false, slots: [] }
      : { dayOfWeek, isOpen: true, slots: WINDOW },
  ),
  schedulePattern: null,
  timeOff: [],
  appointments: [],
  todayDate: '2026-10-15',
  timezone: 'Europe/Chisinau',
  ...overrides,
});

const absence = (type: 'DAY_OFF' | 'CUSTOM_HOURS' | 'BLOCKED', fromDate: string, toDate: string, rest = {}) => ({
  groupId: `${type}-${fromDate}`,
  type,
  fromDate,
  toDate,
  slots: [],
  createdAt: '2026-09-30T08:00:00.000Z',
  ...rest,
});

const dayOf = (weeks: CalendarDay[][], date: string): CalendarDay => {
  const day = weeks.flat().find((candidate) => candidate.date === date);
  if (!day) {
    throw new Error(`${date} is not on the grid`);
  }
  return day;
};

describe('monthWindow', () => {
  it('spans whole weeks, Monday first, around the month', () => {
    expect(monthWindow('2026-10')).toEqual({ from: '2026-09-28', to: '2026-11-01' });
  });

  it('adds no week to a month that already starts on a Monday and ends on a Sunday', () => {
    expect(monthWindow('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});

describe('shiftMonth', () => {
  it('crosses the year both ways', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthOf('2026-10-15')).toBe('2026-10');
  });
});

describe('buildMonthCalendar', () => {
  it('lays the month out in Monday-first weeks, marking the days of its neighbours and today', () => {
    const weeks = buildMonthCalendar('2026-10', schedule());

    expect(weeks.length).toBe(5);
    expect(weeks.every((week) => week.length === 7)).toBeTrue();
    expect(weeks[0][0]).toEqual(jasmine.objectContaining({ date: '2026-09-28', inMonth: false, dayOfMonth: 28 }));
    expect(dayOf(weeks, '2026-10-01').inMonth).toBeTrue();
    expect(
      weeks
        .flat()
        .filter((day) => day.isToday)
        .map((day) => day.date),
    ).toEqual(['2026-10-15']);
  });

  it('opens a day on its weekly window and closes the days the week does not work', () => {
    const weeks = buildMonthCalendar('2026-10', schedule());

    expect(dayOf(weeks, '2026-10-05')).toEqual(jasmine.objectContaining({ status: 'OPEN', slots: WINDOW }));
    expect(dayOf(weeks, '2026-10-04')).toEqual(jasmine.objectContaining({ status: 'CLOSED', slots: [] }));
  });

  it('reads a weekday nobody ever set, and a stored day without windows, as closed', () => {
    const weeks = buildMonthCalendar('2026-10', schedule({ weeklyHours: [{ dayOfWeek: 1, isOpen: true, slots: [] }] }));

    expect(dayOf(weeks, '2026-10-05').status).toBe('CLOSED');
    expect(dayOf(weeks, '2026-10-06').status).toBe('CLOSED');
  });

  it('closes every day of a Відсутність and keeps its reason', () => {
    const weeks = buildMonthCalendar(
      '2026-10',
      schedule({
        timeOff: [absence('DAY_OFF', '2026-10-12', '2026-10-14', { reason: 'Conference' })],
      }),
    );

    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      expect(dayOf(weeks, date)).toEqual(
        jasmine.objectContaining({ status: 'DAY_OFF', slots: [], reason: 'Conference' }),
      );
    }
    expect(dayOf(weeks, '2026-10-15').status).toBe('OPEN');
  });

  it('skips the dates a Відсутність does not cover', () => {
    const weeks = buildMonthCalendar(
      '2026-10',
      schedule({
        timeOff: [absence('BLOCKED', '2026-10-12', '2026-10-14', { skippedDates: ['2026-10-13'] })],
      }),
    );

    expect(dayOf(weeks, '2026-10-12').status).toBe('BLOCKED');
    expect(dayOf(weeks, '2026-10-13').status).toBe('OPEN');
  });

  it('works the особливі години instead of the weekly window — even on a day the week is closed', () => {
    const slots = [{ start: '10:00', end: '14:00' }];
    const weeks = buildMonthCalendar(
      '2026-10',
      schedule({ timeOff: [absence('CUSTOM_HOURS', '2026-10-09', '2026-10-10', { slots })] }),
    );

    expect(dayOf(weeks, '2026-10-09')).toEqual(jasmine.objectContaining({ status: 'CUSTOM_HOURS', slots }));
    expect(dayOf(weeks, '2026-10-10')).toEqual(jasmine.objectContaining({ status: 'CUSTOM_HOURS', slots }));
  });

  it('lets the Ротація take days off the week, before its anchor too, but never open one', () => {
    const weeks = buildMonthCalendar(
      '2026-10',
      // 2 on, 2 off from Monday 5 October.
      schedule({
        schedulePattern: { anchorDate: '2026-10-05', cycleLength: 4, workingOffsets: [0, 1] },
      }),
    );

    expect(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((date) => dayOf(weeks, date).status)).toEqual([
      'OPEN',
      'OPEN',
      'PATTERN_OFF',
      'PATTERN_OFF',
    ]);
    // 1 October is four days before the anchor — position 0 of the cycle.
    expect(dayOf(weeks, '2026-10-01').status).toBe('OPEN');
    // Saturday 10 October is a working position of the cycle, and the week still does not work it.
    expect(dayOf(weeks, '2026-10-10').status).toBe('CLOSED');
  });

  it('ignores a Ротація it cannot read rather than closing the calendar', () => {
    const weeks = buildMonthCalendar(
      '2026-10',
      schedule({
        schedulePattern: { anchorDate: '2026-10-05', cycleLength: 2, workingOffsets: [5] },
      }),
    );

    expect(dayOf(weeks, '2026-10-06').status).toBe('OPEN');
  });

  it("counts the Записи on the venue's own day, cancelled ones apart", () => {
    const weeks = buildMonthCalendar(
      '2026-10',
      schedule({
        appointments: [
          // 00:30 on 6 October in Chișinău.
          {
            appointmentId: 'a1',
            startTime: '2026-10-05T21:30:00Z',
            endTime: '2026-10-05T22:15:00Z',
            status: 'BOOKED',
          },
          {
            appointmentId: 'a2',
            startTime: '2026-10-06T08:00:00Z',
            endTime: '2026-10-06T09:00:00Z',
            status: 'COMPLETED',
          },
          {
            appointmentId: 'a3',
            startTime: '2026-10-06T10:00:00Z',
            endTime: '2026-10-06T11:00:00Z',
            status: 'CANCELLED',
          },
        ],
      }),
    );

    expect(dayOf(weeks, '2026-10-05').appointments).toEqual({ active: 0, cancelled: 0 });
    expect(dayOf(weeks, '2026-10-06').appointments).toEqual({ active: 2, cancelled: 1 });
  });

  describe('inside bounds — the Години роботи of his Салон', () => {
    const BOUNDS = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      dayOfWeek,
      isOpen: true,
      slots: [{ start: '10:00', end: '16:00' }],
    }));

    it('trims a worked day to what the bounds leave of it, as a Клієнт gets it', () => {
      const weeks = buildMonthCalendar('2026-10', schedule(), BOUNDS);

      expect(dayOf(weeks, '2026-10-05')).toEqual(
        jasmine.objectContaining({ status: 'OPEN', slots: [{ start: '10:00', end: '16:00' }] }),
      );
    });

    it('closes a day the bounds are closed on, and особливі години that miss them entirely', () => {
      const saturday = [{ start: '10:00', end: '14:00' }];
      const evening = [{ start: '17:00', end: '20:00' }];
      const weeks = buildMonthCalendar(
        '2026-10',
        schedule({
          timeOff: [
            absence('CUSTOM_HOURS', '2026-10-10', '2026-10-10', { slots: saturday }),
            absence('CUSTOM_HOURS', '2026-10-12', '2026-10-12', { slots: evening }),
          ],
        }),
        BOUNDS,
      );

      expect(dayOf(weeks, '2026-10-10')).toEqual(jasmine.objectContaining({ status: 'BOUNDS_CLOSED', slots: [] }));
      expect(dayOf(weeks, '2026-10-12')).toEqual(jasmine.objectContaining({ status: 'BOUNDS_CLOSED', slots: [] }));
    });

    it('holds nothing to bounds that were never stored', () => {
      expect(dayOf(buildMonthCalendar('2026-10', schedule(), []), '2026-10-05').slots).toEqual(WINDOW);
    });
  });
});
