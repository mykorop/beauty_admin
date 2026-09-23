import type { AppointmentsDay, DetailedStatsRun, GrowthDay } from '../../core/api/stats.client';
import {
  appointmentTotals,
  daysFrom,
  weeksFrom,
  growthTotals,
  periodStart,
  runProgress,
  valueTotals,
} from './detailed-stats-view';

const growth = (day: string, salons = 0, masters = 0, clients = 0): GrowthDay => ({
  day,
  salons,
  masters,
  clients,
});

const appointments = (day: string, counts: Partial<AppointmentsDay> = {}): AppointmentsDay => ({
  day,
  upcoming: 0,
  pastBooked: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  ...counts,
});

const run = (overrides: Partial<DetailedStatsRun> = {}): DetailedStatsRun => ({
  runId: 'run-1',
  status: 'running',
  startedAt: '2026-09-23T09:00:00.000Z',
  finishedAt: null,
  scannedItems: 0,
  estimatedItems: null,
  errorCode: null,
  ...overrides,
});

describe('detailed stats view', () => {
  describe('periodStart', () => {
    it('counts today as the last of the period’s days', () => {
      expect(periodStart('2026-09-23', '30')).toBe('2026-08-25');
      expect(periodStart('2026-09-23', '90')).toBe('2026-06-26');
      expect(periodStart('2026-09-23', '365')).toBe('2025-09-24');
    });

    it('steps over month and year ends as calendar days, not as hours', () => {
      expect(periodStart('2026-03-01', '30')).toBe('2026-01-31');
      expect(periodStart('2026-01-10', '30')).toBe('2025-12-12');
    });

    it('has no start for the whole history', () => {
      expect(periodStart('2026-09-23', 'all')).toBeNull();
    });
  });

  describe('daysFrom', () => {
    const days = [growth('2026-09-20'), growth('2026-09-21'), growth('2026-09-22')];

    it('keeps the days from the start on, including those still ahead', () => {
      expect(daysFrom(days, '2026-09-21').map(({ day }) => day)).toEqual([
        '2026-09-21',
        '2026-09-22',
      ]);
    });

    it('keeps everything without a start', () => {
      expect(daysFrom(days, null)).toEqual(days);
    });
  });

  describe('weeksFrom', () => {
    it('keeps the week the period starts in whole, rather than a part of it', () => {
      const weeks = [growth('2026-09-07', 1), growth('2026-09-14', 2), growth('2026-09-21', 3)];

      // Thursday the 17th falls in the week of Monday the 14th.
      expect(weeksFrom(weeks, '2026-09-17').map(({ day }) => day)).toEqual([
        '2026-09-14',
        '2026-09-21',
      ]);
      // A Sunday is the last day of its week.
      expect(weeksFrom(weeks, '2026-09-13').map(({ day }) => day)).toEqual([
        '2026-09-07',
        '2026-09-14',
        '2026-09-21',
      ]);
      expect(weeksFrom(weeks, null)).toEqual(weeks);
    });
  });

  describe('growthTotals', () => {
    it('adds each kind of registration up', () => {
      expect(growthTotals([growth('a', 1, 0, 3), growth('b', 2, 1, 4)])).toEqual({
        salons: 3,
        masters: 1,
        clients: 7,
      });
    });
  });

  describe('appointmentTotals', () => {
    it('adds the states up, days booked ahead included', () => {
      const totals = appointmentTotals(
        [
          appointments('2026-09-22', { completed: 2, cancelled: 1, pastBooked: 3 }),
          appointments('2026-09-25', { upcoming: 2, cancelled: 1, noShow: 1 }),
        ],
        '2026-09-23',
      );

      expect(totals).toEqual(
        jasmine.objectContaining({
          upcoming: 2,
          pastBooked: 3,
          completed: 2,
          cancelled: 2,
          noShow: 1,
          total: 10,
        }),
      );
    });

    it('takes the share of cancellations of the days up to today only', () => {
      // Days ahead have not had their cancellations yet: counting them would dilute the share.
      const totals = appointmentTotals(
        [
          appointments('2026-09-22', { completed: 2, cancelled: 1, pastBooked: 1 }),
          appointments('2026-09-23', { pastBooked: 1, upcoming: 1, cancelled: 1 }),
          appointments('2026-09-25', { upcoming: 20 }),
        ],
        '2026-09-23',
      );

      expect(totals.cancellationShare).toBe(2 / 7);
    });

    it('has no share of cancellations when no Запис is due yet', () => {
      expect(
        appointmentTotals([appointments('2026-09-22')], '2026-09-23').cancellationShare,
      ).toBeNull();
      expect(
        appointmentTotals([appointments('2026-09-25', { upcoming: 3 })], '2026-09-23')
          .cancellationShare,
      ).toBeNull();
      expect(appointmentTotals([], '2026-09-23').total).toBe(0);
    });
  });

  describe('valueTotals', () => {
    it('adds past and ahead apart, without floating-point residue', () => {
      expect(
        valueTotals([
          { day: 'a', past: 0.1, ahead: 0 },
          { day: 'b', past: 0.2, ahead: 150.5 },
          { day: 'c', past: 0, ahead: 49.5 },
        ]),
      ).toEqual({ past: 0.3, ahead: 200 });
    });
  });

  describe('runProgress', () => {
    it('is the share of the estimated table read so far', () => {
      expect(runProgress(run({ scannedItems: 1250, estimatedItems: 5000 }))).toBe(25);
    });

    it('never claims to be done while the run is still reading', () => {
      // The estimate lags the table by hours, so the count can run past it.
      expect(runProgress(run({ scannedItems: 6000, estimatedItems: 5000 }))).toBe(99);
    });

    it('has no share without an estimate', () => {
      expect(runProgress(run({ scannedItems: 1250, estimatedItems: null }))).toBeNull();
      expect(runProgress(run({ scannedItems: 0, estimatedItems: 0 }))).toBeNull();
    });
  });
});
