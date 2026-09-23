import {
  isScoped,
  matchesAddress,
  parsePlatformAppointmentFilters,
  toApiQuery,
  toQueryParams,
} from './platform-appointment-filters';

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});

const TODAY = '2026-09-23';

describe('parsePlatformAppointmentFilters', () => {
  it('reads an address that names nobody as the whole platform on today', () => {
    expect(parsePlatformAppointmentFilters(params({}), TODAY)).toEqual({
      salonId: null,
      masterId: null,
      clientId: null,
      date: TODAY,
      from: null,
      to: null,
      status: null,
    });
  });

  it('reads the day and the status the address names for the whole platform', () => {
    expect(
      parsePlatformAppointmentFilters(params({ date: '2026-09-20', status: 'CANCELLED' }), TODAY),
    ).toEqual(
      jasmine.objectContaining({ date: '2026-09-20', status: 'CANCELLED', from: null, to: null }),
    );
  });

  it('reads a Салон, a Майстер or a Клієнт as a window around today — never a day of the platform', () => {
    const bySalon = parsePlatformAppointmentFilters(
      params({ salonId: 's-1', date: '2026-09-20' }),
      TODAY,
    );

    expect(bySalon).toEqual({
      salonId: 's-1',
      masterId: null,
      clientId: null,
      date: null,
      from: '2026-08-24',
      to: '2026-10-23',
      status: null,
    });
    expect(
      isScoped(parsePlatformAppointmentFilters(params({ masterId: 'm-1' }), TODAY)),
    ).toBeTrue();
    expect(
      isScoped(parsePlatformAppointmentFilters(params({ clientId: 'c-1' }), TODAY)),
    ).toBeTrue();
  });

  it('keeps the window the address names for a narrowed list, and trims one the backend would refuse', () => {
    const named = parsePlatformAppointmentFilters(
      params({ clientId: 'c-1', from: '2026-09-01', to: '2026-09-30', status: 'NO_SHOW' }),
      TODAY,
    );
    const tooWide = parsePlatformAppointmentFilters(
      params({ clientId: 'c-1', from: '2026-01-01', to: '2026-12-31' }),
      TODAY,
    );

    expect(named).toEqual(
      jasmine.objectContaining({ from: '2026-09-01', to: '2026-09-30', status: 'NO_SHOW' }),
    );
    expect(tooWide).toEqual(jasmine.objectContaining({ from: '2026-01-01', to: '2026-04-02' }));
  });

  it('drops what a hand-edited address got wrong', () => {
    expect(
      parsePlatformAppointmentFilters(
        params({ salonId: ' ', date: '23.09.2026', status: 'ARRIVED' }),
        TODAY,
      ),
    ).toEqual(jasmine.objectContaining({ salonId: null, date: TODAY, status: null }));
  });
});

describe('the address of a view', () => {
  it('holds a day for the whole platform and a window for a narrowed list, and never both', () => {
    const day = parsePlatformAppointmentFilters(
      params({ date: '2026-09-20', from: '2026-09-01' }),
      TODAY,
    );
    const narrowed = parsePlatformAppointmentFilters(
      params({ salonId: 's-1', date: '2026-09-20' }),
      TODAY,
    );

    expect(toQueryParams(day)).toEqual({
      salonId: null,
      masterId: null,
      clientId: null,
      date: '2026-09-20',
      from: null,
      to: null,
      status: null,
    });
    expect(toQueryParams(narrowed)).toEqual(
      jasmine.objectContaining({
        salonId: 's-1',
        date: null,
        from: '2026-08-24',
        to: '2026-10-23',
      }),
    );
  });

  it('knows when the address already spells the filters shown — and when it must be rewritten', () => {
    const shown = parsePlatformAppointmentFilters(params({ date: '2026-09-20' }), TODAY);

    expect(matchesAddress(params({ date: '2026-09-20' }), shown)).toBeTrue();
    expect(
      matchesAddress(params({}), parsePlatformAppointmentFilters(params({}), TODAY)),
    ).toBeFalse();
    expect(matchesAddress(params({ date: '2026-09-20', from: '2026-09-01' }), shown)).toBeFalse();
  });
});

describe('toApiQuery', () => {
  it('asks the backend for the narrowed list with every id and the status the view names', () => {
    const filters = parsePlatformAppointmentFilters(
      params({
        salonId: 's-1',
        masterId: 'm-1',
        from: '2026-09-01',
        to: '2026-09-30',
        status: 'BOOKED',
      }),
      TODAY,
    );

    expect(toApiQuery(filters)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      salonId: 's-1',
      masterId: 'm-1',
      status: 'BOOKED',
    });
  });
});
