import { ApiError } from '../../core/api/api-error';
import { buildHoursWeek, daysOutsideBounds, hoursRefusals, toWeekFormValue } from './week-hours';

const LUNCH_BREAK = [
  { start: '09:00', end: '13:00' },
  { start: '14:00', end: '19:00' },
];
const STORED = [
  { dayOfWeek: 0, isOpen: false, slots: [] },
  { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 2, isOpen: true, slots: LUNCH_BREAK },
];

describe('buildHoursWeek', () => {
  it('is null while the editor shows what it was opened with', () => {
    expect(buildHoursWeek(STORED, toWeekFormValue(STORED))).toBeNull();
  });

  it('shows a split day as the span around its windows', () => {
    expect(toWeekFormValue(STORED)[2]).toEqual({ isOpen: true, start: '09:00', end: '19:00' });
  });

  it('sends all seven days, keeping the windows of a day nobody touched', () => {
    const week = toWeekFormValue(STORED);
    week[1] = { isOpen: true, start: '10:00', end: '18:00' };

    const body = buildHoursWeek(STORED, week);

    expect(body?.map((day) => day.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(body?.[1].slots).toEqual([{ start: '10:00', end: '18:00' }]);
    expect(body?.[2].slots).toEqual(LUNCH_BREAK);
    // Never set → stated closed.
    expect(body?.[3]).toEqual({ dayOfWeek: 3, isOpen: false, slots: [] });
  });

  it('turns a touched split day into one window, even retyped to the same span', () => {
    const week = toWeekFormValue(STORED);

    expect(buildHoursWeek(STORED, week, new Set([2]))?.[2].slots).toEqual([{ start: '09:00', end: '19:00' }]);
  });

  it('ignores the hidden window of a closed day', () => {
    const week = toWeekFormValue(STORED);
    week[0] = { isOpen: false, start: '11:00', end: '12:00' };

    expect(buildHoursWeek(STORED, week)).toBeNull();
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

  it("reads a master's week by the same rules, under its own body key", () => {
    const error = new ApiError('VALIDATION_ERROR', 'Validation failed', 422, {
      body: { 'masterHours.2.slots.0.end': ['slot start must be earlier than end'] },
    });

    expect(hoursRefusals(error)).toEqual([{ key: 'hours.refusal.startAfterEnd', dayOfWeek: 2 }]);
  });

  it('names the day of a master that falls outside the Години роботи, and what it had to fit', () => {
    const outside = new ApiError('MASTER_HOURS_OUTSIDE_SALON_HOURS', 'x', 400, {
      dayOfWeek: 3,
      outsideSlot: { start: '08:00', end: '18:00' },
      salonSlots: [{ start: '09:00', end: '18:00' }],
    });
    const closedDay = new ApiError('MASTER_HOURS_OUTSIDE_SALON_HOURS', 'x', 400, {
      dayOfWeek: 6,
      outsideSlot: null,
      salonSlots: [],
    });

    expect(hoursRefusals(outside)).toEqual([
      {
        key: 'hours.refusal.outsideBounds',
        dayOfWeek: 3,
        slot: '08:00 – 18:00',
        bounds: '09:00 – 18:00',
      },
    ]);
    expect(hoursRefusals(closedDay)).toEqual([{ key: 'hours.refusal.boundsClosed', dayOfWeek: 6 }]);
  });

  it('leaves any other refusal to its general wording', () => {
    expect(hoursRefusals(new ApiError('SALON_DELETED', 'x', 409))).toEqual([]);
    expect(hoursRefusals(new ApiError('VALIDATION_ERROR', 'x', 422, { body: { reason: ['too long'] } }))).toEqual([]);
  });
});

describe('daysOutsideBounds', () => {
  const BOUNDS = [
    { dayOfWeek: 0, isOpen: false, slots: [] },
    { dayOfWeek: 1, isOpen: true, slots: LUNCH_BREAK },
  ];
  const day = (isOpen: boolean, start = '09:00', end = '18:00') => ({ isOpen, start, end });
  const weekOf = (changes: Record<number, ReturnType<typeof day>>) =>
    [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => changes[dayOfWeek] ?? day(false));

  it('flags a working day the bounds are closed on, or one reaching past every window of theirs', () => {
    expect(daysOutsideBounds(weekOf({ 0: day(true), 1: day(true, '09:00', '14:30') }), BOUNDS)).toEqual([0, 1]);
  });

  it('lets a day inside one window be, and a day off', () => {
    expect(daysOutsideBounds(weekOf({ 0: day(false), 1: day(true, '14:00', '19:00') }), BOUNDS)).toEqual([]);
  });

  it('reads a day the bounds never set as closed, as the domain does once any day is stored', () => {
    expect(daysOutsideBounds(weekOf({ 2: day(true) }), BOUNDS)).toEqual([2]);
  });

  it('holds nothing to bounds that are not there', () => {
    expect(daysOutsideBounds(weekOf({ 0: day(true) }), null)).toEqual([]);
    expect(daysOutsideBounds(weekOf({ 0: day(true) }), [])).toEqual([]);
  });
});
