import { ApiError } from '../../core/api/api-error';
import {
  buildTimeOff,
  formatPeriod,
  timeOffConflict,
  timeOffIssue,
  type TimeOffFormValue,
} from './time-off';

const form = (overrides: Partial<TimeOffFormValue> = {}): TimeOffFormValue => ({
  type: 'DAY_OFF',
  fromDate: '2026-10-12',
  toDate: '2026-10-14',
  start: '10:00',
  end: '14:00',
  reason: '',
  ...overrides,
});

describe('Відсутність form', () => {
  it('builds a whole-day Відсутність without windows and without an empty reason', () => {
    expect(buildTimeOff(form({ reason: '  ' }))).toEqual({
      type: 'DAY_OFF',
      fromDate: '2026-10-12',
      toDate: '2026-10-14',
    });
  });

  it('builds особливі години with the one window still worked', () => {
    expect(buildTimeOff(form({ type: 'CUSTOM_HOURS', reason: ' Dentist ' }))).toEqual({
      type: 'CUSTOM_HOURS',
      fromDate: '2026-10-12',
      toDate: '2026-10-14',
      slots: [{ start: '10:00', end: '14:00' }],
      reason: 'Dentist',
    });
  });

  it('finds nothing wrong with a range that started before today but has not ended', () => {
    expect(timeOffIssue(form({ fromDate: '2026-10-01' }), '2026-10-13')).toBeNull();
  });

  (
    [
      ['no dates', form({ fromDate: '' }), 'timeOff.issue.dates'],
      ['a reversed range', form({ fromDate: '2026-10-15' }), 'timeOff.issue.reversed'],
      ['a range that already ended', form(), 'timeOff.issue.past'],
      ['more than 90 days', form({ toDate: '2027-01-10' }), 'timeOff.issue.tooLong'],
      [
        'a window that ends before it starts',
        form({ type: 'CUSTOM_HOURS', end: '09:00' }),
        'timeOff.issue.window',
      ],
    ] as const
  ).forEach(([label, value, issue]) => {
    it(`names ${label}`, () => {
      expect(
        timeOffIssue(value, label === 'a range that already ended' ? '2026-10-20' : '2026-10-01'),
      ).toBe(issue);
    });
  });

  it('accepts exactly 90 days', () => {
    expect(
      timeOffIssue(form({ fromDate: '2026-10-01', toDate: '2026-12-29' }), '2026-10-01'),
    ).toBeNull();
  });

  it('ignores the window of a whole-day Відсутність', () => {
    expect(timeOffIssue(form({ end: '09:00' }), '2026-10-01')).toBeNull();
  });
});

describe('timeOffConflict', () => {
  it('reads the days and the number of Записи in the way', () => {
    const error = new ApiError('TIME_OFF_HAS_APPOINTMENTS', 'x', 409, {
      dates: ['2026-10-13'],
      appointmentCount: 2,
      appointments: [],
    });

    expect(timeOffConflict(error)).toEqual({ dates: ['2026-10-13'], appointmentCount: 2 });
  });

  it('is nothing for any other refusal', () => {
    expect(timeOffConflict(new ApiError('SALON_DELETED', 'x', 409))).toBeNull();
    expect(timeOffConflict(new Error('x'))).toBeNull();
  });
});

describe('formatPeriod', () => {
  it('writes one day once and a range with both ends', () => {
    expect(formatPeriod('2026-10-12', '2026-10-12', 'en-GB')).toBe('12 Oct 2026');
    expect(formatPeriod('2026-10-12', '2026-10-14', 'en-GB')).toBe('12 Oct 2026 – 14 Oct 2026');
  });
});
