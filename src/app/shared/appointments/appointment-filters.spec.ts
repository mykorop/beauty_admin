import {
  defaultAppointmentWindow,
  isStaleBooking,
  matchesAddress,
  MAX_APPOINTMENT_WINDOW_DAYS,
  parseAppointmentFilters,
  toApiQuery,
  toQueryParams,
} from './appointment-filters';

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});

const TODAY = '2026-09-22';

describe('defaultAppointmentWindow', () => {
  it('opens a month either side of the venue’s today', () => {
    expect(defaultAppointmentWindow(TODAY)).toEqual({ from: '2026-08-23', to: '2026-10-22' });
  });
});

describe('parseAppointmentFilters', () => {
  it('reads an empty address as the default window and no other filter', () => {
    expect(parseAppointmentFilters(params({}), TODAY)).toEqual({
      from: '2026-08-23',
      to: '2026-10-22',
      status: null,
      masterId: null,
    });
  });

  it('reads every filter from the address', () => {
    expect(
      parseAppointmentFilters(
        params({ from: '2026-09-01', to: '2026-09-30', status: 'CANCELLED', masterId: 'm-2' }),
        TODAY,
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-09-30', status: 'CANCELLED', masterId: 'm-2' });
  });

  it('drops what a hand-edited address got wrong', () => {
    const filters = parseAppointmentFilters(params({ from: '01.09.2026', status: 'ARRIVED', masterId: ' ' }), TODAY);

    expect(filters).toEqual({ from: '2026-08-23', to: '2026-10-22', status: null, masterId: null });
  });

  it('never asks for a window the backend refuses: reversed, unbounded or wider than the cap', () => {
    const reversed = parseAppointmentFilters(params({ from: '2026-09-10', to: '2026-09-01' }), TODAY);
    const openEnded = parseAppointmentFilters(params({ from: '2026-12-01' }), TODAY);
    const tooWide = parseAppointmentFilters(params({ from: '2026-01-01', to: '2026-12-31' }), TODAY);

    // The default end has been overtaken by the asked start, so the window is that one day.
    expect(reversed).toEqual(jasmine.objectContaining({ from: '2026-09-10', to: '2026-10-22' }));
    expect(openEnded).toEqual(jasmine.objectContaining({ from: '2026-12-01', to: '2026-12-01' }));
    expect(tooWide).toEqual(jasmine.objectContaining({ from: '2026-01-01', to: '2026-04-02' }));
    expect(
      (Date.parse(`${tooWide.to}T00:00:00Z`) - Date.parse(`${tooWide.from}T00:00:00Z`)) / 86_400_000,
    ).toBeLessThan(MAX_APPOINTMENT_WINDOW_DAYS);
  });

  it('keeps a one-day window', () => {
    expect(parseAppointmentFilters(params({ from: '2026-09-10', to: '2026-09-10' }), TODAY)).toEqual(
      jasmine.objectContaining({ from: '2026-09-10', to: '2026-09-10' }),
    );
  });
});

describe('toQueryParams', () => {
  it('writes unset filters as null so the router removes them', () => {
    expect(toQueryParams({ from: '2026-09-01', to: '2026-09-30', status: null, masterId: null })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      status: null,
      masterId: null,
    });
  });

  it('round-trips through parse', () => {
    const filters = parseAppointmentFilters(
      params({ from: '2026-09-01', to: '2026-09-30', status: 'NO_SHOW', masterId: 'm-2' }),
      TODAY,
    );
    const written = toQueryParams(filters);

    expect(parseAppointmentFilters({ get: (name) => written[name] }, TODAY)).toEqual(filters);
  });
});

describe('matchesAddress', () => {
  it('holds when the address already spells the filters', () => {
    const address = params({ from: '2026-09-01', to: '2026-09-30', status: 'BOOKED' });

    expect(matchesAddress(address, parseAppointmentFilters(address, TODAY))).toBe(true);
  });

  it('fails for an address the tab had to correct — so the tab can rewrite it', () => {
    const noWindow = params({});
    const tooWide = params({ from: '2026-01-01', to: '2026-12-31' });

    expect(matchesAddress(noWindow, parseAppointmentFilters(noWindow, TODAY))).toBe(false);
    expect(matchesAddress(tooWide, parseAppointmentFilters(tooWide, TODAY))).toBe(false);
  });
});

describe('toApiQuery', () => {
  it('sends the window always and the rest only when set', () => {
    expect(toApiQuery({ from: '2026-09-01', to: '2026-09-30', status: null, masterId: null })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(toApiQuery({ from: '2026-09-01', to: '2026-09-30', status: 'BOOKED', masterId: 'm-2' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      status: 'BOOKED',
      masterId: 'm-2',
    });
  });
});

describe('isStaleBooking', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  it('marks a booked Запис whose time has passed', () => {
    expect(isStaleBooking({ status: 'BOOKED', endTime: '2026-09-22T11:59:00Z' }, now)).toBe(true);
  });

  it('leaves a booked Запис still ahead alone', () => {
    expect(isStaleBooking({ status: 'BOOKED', endTime: '2026-09-22T12:30:00Z' }, now)).toBe(false);
  });

  it('leaves a past Запис somebody has closed alone', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(isStaleBooking({ status, endTime: '2026-09-20T10:00:00Z' }, now)).toBe(false);
    }
  });
});
