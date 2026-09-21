import { ApiError } from '../../core/api/api-error';
import { buildSalonHoursWeek, hoursRefusals, toWeekFormValue } from './salon-hours-week';

const LUNCH_BREAK = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '19:00' },
];
const STORED = [
  { dayOfWeek: 0, isOpen: false, slots: [] },
  { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 2, isOpen: true, slots: LUNCH_BREAK },
];

describe('buildSalonHoursWeek', () => {
  it('is null while the editor shows what it was opened with', () => {
    expect(buildSalonHoursWeek(STORED, toWeekFormValue(STORED))).toBeNull();
  });

  it('shows a split day as the span around its windows', () => {
    expect(toWeekFormValue(STORED)[2]).toEqual({ isOpen: true, start: '09:00', end: '19:00' });
  });

  it('sends all seven days, keeping the windows of a day nobody touched', () => {
    const week = toWeekFormValue(STORED);
    week[1] = { isOpen: true, start: '10:00', end: '18:00' };

    const body = buildSalonHoursWeek(STORED, week);

    expect(body?.map((day) => day.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(body?.[1].slots).toEqual([{ start: '10:00', end: '18:00' }]);
    expect(body?.[2].slots).toEqual(LUNCH_BREAK);
    // Never set → stated closed.
    expect(body?.[3]).toEqual({ dayOfWeek: 3, isOpen: false, slots: [] });
  });

  it('turns a touched split day into one window, even retyped to the same span', () => {
    const week = toWeekFormValue(STORED);

    expect(buildSalonHoursWeek(STORED, week, new Set([2]))?.[2].slots).toEqual([{ start: '09:00', end: '19:00' }]);
  });

  it('ignores the hidden window of a closed day', () => {
    const week = toWeekFormValue(STORED);
    week[0] = { isOpen: false, start: '11:00', end: '12:00' };

    expect(buildSalonHoursWeek(STORED, week)).toBeNull();
  });
});

describe('hoursRefusals', () => {
  it('names each broken schema rule, with its day when the rule is about one', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Validation failed', 422, {
      body: {
        salonHours: ['the week must have at least one open day'],
        'salonHours.5.slots.0.end': ['slot must cover at least one hour', 'something new'],
      },
    });

    expect(hoursRefusals(error)).toEqual([
      { key: 'hours.refusal.noOpenDay' },
      { key: 'hours.refusal.shortWindow', dayOfWeek: 5 },
    ]);
  });

  it('names every master outside the new week', () => {
    const error = new ApiError('ROSTER_HOURS_OUTSIDE_SALON_HOURS', 'x', 409, {
      masters: [{ masterId: 'm1', masterName: 'Ion Ceban', dayOfWeek: 5 }],
    });

    expect(hoursRefusals(error)).toEqual([
      { key: 'hours.refusal.masterOutside', masterName: 'Ion Ceban', dayOfWeek: 5 },
    ]);
  });

  it('leaves any other refusal to its general wording', () => {
    expect(hoursRefusals(new ApiError('SALON_DELETED', 'x', 409))).toEqual([]);
    expect(hoursRefusals(new ApiError('VALIDATION_ERROR', 'x', 422, { body: { reason: ['too long'] } }))).toEqual([]);
  });
});
