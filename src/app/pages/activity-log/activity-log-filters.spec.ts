import {
  type ActivityLogFilters,
  changePeriod,
  NO_ACTIVITY_LOG_FILTERS,
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
  it('reads an empty address as no period', () => {
    expect(parseActivityLogFilters(params({}))).toEqual(NO_ACTIVITY_LOG_FILTERS);
  });

  it('reads the period from the address', () => {
    expect(parseActivityLogFilters(params({ from: '2026-09-01', to: '2026-09-21' }))).toEqual({
      from: '2026-09-01',
      to: '2026-09-21',
    });
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
    expect(parseActivityLogFilters(params({ from: '2026-09-10', to: '2026-09-01' }))).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
  });

  it('ignores parameters that are not its own', () => {
    expect(parseActivityLogFilters(params({ targetType: 'salon', cursor: 'abc' }))).toEqual(
      NO_ACTIVITY_LOG_FILTERS,
    );
  });
});

describe('changePeriod', () => {
  it('sets one end and keeps the other', () => {
    expect(changePeriod(filters({ from: '2026-09-01' }), { to: '2026-09-21' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-21',
    });
    expect(changePeriod(filters({ from: '2026-09-01', to: '2026-09-21' }), { from: null })).toEqual(
      filters({ to: '2026-09-21' }),
    );
  });

  it('drops the other end rather than write a period that ends before it starts', () => {
    expect(changePeriod(filters({ from: '2026-09-10', to: '2026-09-21' }), { to: '2026-09-01' })).toEqual(
      filters({ to: '2026-09-01' }),
    );
    expect(changePeriod(filters({ from: '2026-09-01', to: '2026-09-10' }), { from: '2026-09-21' })).toEqual(
      filters({ from: '2026-09-21' }),
    );
  });
});

describe('toQueryParams', () => {
  it('writes unset ends as null so the router removes them', () => {
    expect(toQueryParams(filters({ from: '2026-09-01' }))).toEqual({ from: '2026-09-01', to: null });
  });

  it('round-trips through parse', () => {
    const state = filters({ from: '2026-09-01', to: '2026-09-21' });
    const written = toQueryParams(state);
    expect(parseActivityLogFilters({ get: (name) => written[name] ?? null })).toEqual(state);
  });
});

describe('toApiFilters', () => {
  it('asks for nothing without a period, so the backend serves today', () => {
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
});
