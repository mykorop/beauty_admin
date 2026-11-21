import {
  type ActivityLogFilters,
  changeFilters,
  NO_ACTIVITY_LOG_FILTERS,
  openPeriod,
  parseActivityLogFilters,
  toApiFilters,
  toQueryParams,
} from './activity-log-filters';

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});
const filters = (overrides: Partial<ActivityLogFilters>): ActivityLogFilters => ({
  ...NO_ACTIVITY_LOG_FILTERS,
  ...overrides,
});

describe('parseActivityLogFilters', () => {
  it('reads an empty address as no filter at all', () => {
    expect(parseActivityLogFilters(params({}))).toEqual(NO_ACTIVITY_LOG_FILTERS);
  });

  it('reads the period from the address', () => {
    expect(parseActivityLogFilters(params({ from: '2026-09-01', to: '2026-09-21' }))).toEqual(
      filters({ from: '2026-09-01', to: '2026-09-21' }),
    );
  });

  it('keeps a period open on either side', () => {
    expect(parseActivityLogFilters(params({ from: '2026-09-01' }))).toEqual(filters({ from: '2026-09-01' }));
    expect(parseActivityLogFilters(params({ to: '2026-09-21' }))).toEqual(filters({ to: '2026-09-21' }));
  });

  it('keeps a one-day period', () => {
    expect(parseActivityLogFilters(params({ from: '2026-09-10', to: '2026-09-10' }))).toEqual(
      filters({ from: '2026-09-10', to: '2026-09-10' }),
    );
  });

  it('reads an end that is not a day as not set', () => {
    expect(parseActivityLogFilters(params({ from: '01.09.2026', to: '2026-02-31' }))).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
    expect(parseActivityLogFilters(params({ from: '2026-09-01', to: 'yesterday' }))).toEqual(
      filters({ from: '2026-09-01' }),
    );
  });

  it('reads a period that ends before it starts as no period at all', () => {
    expect(parseActivityLogFilters(params({ from: '2026-09-10', to: '2026-09-01', role: 'client' }))).toEqual(
      filters({ role: 'client' }),
    );
  });

  it('reads every filter from the address', () => {
    expect(
      parseActivityLogFilters(
        params({
          account: 'ana@example.com',
          place: 'salon-2',
          role: 'salon_admin',
          outcome: 'rejected',
          service: 'client-api',
          route: 'PATCH /client/appointments/{appointmentId}/cancel',
        }),
      ),
    ).toEqual(
      filters({
        account: 'ana@example.com',
        place: 'salon-2',
        role: 'salon_admin',
        outcome: 'rejected',
        service: 'client-api',
        route: 'PATCH /client/appointments/{appointmentId}/cancel',
      }),
    );
  });

  it('reads the Cognito actions and nobody signed in as filters too', () => {
    expect(parseActivityLogFilters(params({ role: 'anonymous', service: 'cognito', route: 'auth.code-sent' }))).toEqual(
      filters({ role: 'anonymous', service: 'cognito', route: 'auth.code-sent' }),
    );
  });

  it('takes an email as long as an address can be, and an id as long as the backend takes one', () => {
    const email = `${'a'.repeat(200)}@example.com`;

    expect(parseActivityLogFilters(params({ account: email })).account).toBe(email);
    expect(parseActivityLogFilters(params({ account: 'x'.repeat(129) })).account).toBeNull();
    expect(parseActivityLogFilters(params({ account: `${'a'.repeat(250)}@example.com` })).account).toBeNull();
  });

  it('trims an account and a Місце', () => {
    expect(parseActivityLogFilters(params({ account: '  client-sub-1 ', place: ' nina ' }))).toEqual(
      filters({ account: 'client-sub-1', place: 'nina' }),
    );
  });

  it('reads a value the filter does not have as not set', () => {
    expect(
      parseActivityLogFilters(
        params({
          account: 'two words',
          place: 'x'.repeat(129),
          role: 'owner',
          outcome: 'denied',
          service: 'search-api',
          route: 'cancel everything',
        }),
      ),
    ).toEqual(NO_ACTIVITY_LOG_FILTERS);
    expect(parseActivityLogFilters(params({ account: '   ', place: '', route: '' }))).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
  });

  it('ignores parameters that are not its own', () => {
    expect(parseActivityLogFilters(params({ targetType: 'salon', cursor: 'abc' }))).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
  });
});

describe('changeFilters', () => {
  it('sets one end and keeps the other', () => {
    expect(changeFilters(filters({ from: '2026-09-01' }), { to: '2026-09-21' })).toEqual(
      filters({ from: '2026-09-01', to: '2026-09-21' }),
    );
    expect(changeFilters(filters({ from: '2026-09-01', to: '2026-09-21' }), { from: null })).toEqual(
      filters({ to: '2026-09-21' }),
    );
  });

  it('drops the other end rather than write a period that ends before it starts', () => {
    expect(changeFilters(filters({ from: '2026-09-10', to: '2026-09-21' }), { to: '2026-09-01' })).toEqual(
      filters({ to: '2026-09-01' }),
    );
    expect(changeFilters(filters({ from: '2026-09-01', to: '2026-09-10' }), { from: '2026-09-21' })).toEqual(
      filters({ from: '2026-09-21' }),
    );
  });

  it('reads a cleared input as not set', () => {
    expect(changeFilters(filters({ from: '2026-09-01', account: 'client-sub-1' }), { from: '', account: '' })).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
  });

  it('keeps the other filters as they are', () => {
    const current = filters({ from: '2026-09-01', role: 'client', route: 'POST /client/appointments' });

    expect(changeFilters(current, { outcome: 'failed' })).toEqual({ ...current, outcome: 'failed' });
    expect(changeFilters(current, { role: null })).toEqual({ ...current, role: null });
  });

  it('keeps what was typed as the address would read it back', () => {
    expect(changeFilters(NO_ACTIVITY_LOG_FILTERS, { account: ' Ana@Example.com ' })).toEqual(
      filters({ account: 'Ana@Example.com' }),
    );
    expect(changeFilters(filters({ place: 'salon-2' }), { place: 'two words' })).toEqual(NO_ACTIVITY_LOG_FILTERS);
  });
});

describe('openPeriod', () => {
  it('is today when nothing names a period', () => {
    expect(openPeriod(NO_ACTIVITY_LOG_FILTERS)).toBe('today');
    expect(openPeriod(filters({ role: 'client', outcome: 'failed' }))).toBe('today');
  });

  it('is all that is kept for an account or a Місце', () => {
    expect(openPeriod(filters({ account: 'client-sub-1' }))).toBe('kept');
    expect(openPeriod(filters({ place: 'salon-2', outcome: 'failed' }))).toBe('kept');
  });

  it('is none once either end of a period is set', () => {
    expect(openPeriod(filters({ from: '2026-09-01' }))).toBeNull();
    expect(openPeriod(filters({ to: '2026-09-21', account: 'client-sub-1' }))).toBeNull();
  });
});

describe('toQueryParams', () => {
  it('writes unset filters as null so the router removes them', () => {
    expect(toQueryParams(filters({ from: '2026-09-01' }))).toEqual({
      from: '2026-09-01',
      to: null,
      account: null,
      place: null,
      role: null,
      outcome: null,
      service: null,
      route: null,
    });
  });

  it('round-trips through parse', () => {
    const state = filters({
      from: '2026-09-01',
      to: '2026-09-21',
      account: 'ana@example.com',
      place: 'salon-2',
      role: 'anonymous',
      outcome: 'failed',
      service: 'master-api',
      route: 'PUT /master/hours',
    });
    const written = toQueryParams(state);
    expect(parseActivityLogFilters({ get: (name) => written[name] ?? null })).toEqual(state);
  });
});

describe('toApiFilters', () => {
  it('asks for nothing without a filter, so the backend serves today', () => {
    expect(toApiFilters(NO_ACTIVITY_LOG_FILTERS)).toEqual({});
  });

  it('turns the days into instants on the platform’s clock, the last day included in full', () => {
    expect(toApiFilters(filters({ from: '2026-09-01', to: '2026-09-21' }))).toEqual({
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
    });
  });

  it('crosses a month end and the change of clocks', () => {
    expect(toApiFilters(filters({ to: '2026-09-30' }))).toEqual({ to: '2026-09-30T21:00:00.000Z' });
    expect(toApiFilters(filters({ from: '2026-10-26' }))).toEqual({ from: '2026-10-25T22:00:00.000Z' });
  });

  it('asks for an account by its email when it is one, and by its id otherwise', () => {
    expect(toApiFilters(filters({ account: 'ana@example.com' }))).toEqual({ account: 'ana@example.com' });
    expect(toApiFilters(filters({ account: 'client-sub-1' }))).toEqual({ actorId: 'client-sub-1' });
  });

  it('passes the Місце and the rest as the backend names them', () => {
    expect(
      toApiFilters(
        filters({
          place: 'salon-2',
          role: 'anonymous',
          outcome: 'rejected',
          service: 'client-api',
          route: 'POST /client/appointments',
        }),
      ),
    ).toEqual({
      placeId: 'salon-2',
      role: 'anonymous',
      outcome: 'rejected',
      service: 'client-api',
      route: 'POST /client/appointments',
    });
  });
});
