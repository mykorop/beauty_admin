import {
  type AuditLogFilters,
  NO_AUDIT_LOG_FILTERS,
  parseAuditLogFilters,
  toApiFilters,
  toQueryParams,
  zonedDayStart,
} from './audit-log-filters';

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});
const filters = (overrides: Partial<AuditLogFilters>): AuditLogFilters => ({
  ...NO_AUDIT_LOG_FILTERS,
  ...overrides,
});

describe('parseAuditLogFilters', () => {
  it('reads an empty address as no filters', () => {
    expect(parseAuditLogFilters(params({}))).toEqual(NO_AUDIT_LOG_FILTERS);
  });

  it('reads every filter from the address', () => {
    expect(
      parseAuditLogFilters(
        params({ from: '2026-09-01', to: '2026-09-21', targetType: 'salon', action: 'salon.profile.update' }),
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-09-21', targetType: 'salon', action: 'salon.profile.update' });
  });

  it('drops what a hand-edited address got wrong', () => {
    expect(
      parseAuditLogFilters(params({ from: '01.09.2026', to: '2026-02-31', targetType: 'planet', action: 'explode' })),
    ).toEqual(NO_AUDIT_LOG_FILTERS);
  });

  it('drops an end that precedes the start', () => {
    expect(parseAuditLogFilters(params({ from: '2026-09-10', to: '2026-09-01' }))).toEqual(
      filters({ from: '2026-09-10' }),
    );
  });

  it('keeps a one-day range', () => {
    expect(parseAuditLogFilters(params({ from: '2026-09-10', to: '2026-09-10' }))).toEqual(
      filters({ from: '2026-09-10', to: '2026-09-10' }),
    );
  });
});

describe('toQueryParams', () => {
  it('writes unset filters as null so the router removes them', () => {
    expect(toQueryParams(filters({ action: 'salon.profile.update' }))).toEqual({
      from: null,
      to: null,
      targetType: null,
      action: 'salon.profile.update',
    });
  });

  it('round-trips through parse', () => {
    const state = filters({ from: '2026-09-01', targetType: 'salon' });
    const written = toQueryParams(state);
    expect(parseAuditLogFilters({ get: (name) => written[name] ?? null })).toEqual(state);
  });
});

describe('zonedDayStart', () => {
  it('is midnight on the platform’s clock, in summer and in winter', () => {
    expect(zonedDayStart('2026-09-01', 'Europe/Chisinau')).toBe('2026-08-31T21:00:00.000Z');
    expect(zonedDayStart('2026-01-15', 'Europe/Chisinau')).toBe('2026-01-14T22:00:00.000Z');
  });

  it('holds on the days the clocks change', () => {
    // 29 March 2026: 02:00 → 03:00. Midnight is still on winter time, the next one on summer time.
    expect(zonedDayStart('2026-03-29', 'Europe/Chisinau')).toBe('2026-03-28T22:00:00.000Z');
    expect(zonedDayStart('2026-03-30', 'Europe/Chisinau')).toBe('2026-03-29T21:00:00.000Z');
    expect(zonedDayStart('2026-10-25', 'Europe/Chisinau')).toBe('2026-10-24T21:00:00.000Z');
    expect(zonedDayStart('2026-10-26', 'Europe/Chisinau')).toBe('2026-10-25T22:00:00.000Z');
  });

  it('works west of Greenwich too', () => {
    expect(zonedDayStart('2026-09-01', 'America/Los_Angeles')).toBe('2026-09-01T07:00:00.000Z');
  });
});

describe('toApiFilters', () => {
  it('sends nothing for no filters', () => {
    expect(toApiFilters(NO_AUDIT_LOG_FILTERS)).toEqual({});
  });

  it('turns the days into instants on the platform’s clock, the last day included in full', () => {
    expect(toApiFilters(filters({ from: '2026-09-01', to: '2026-09-21', targetType: 'salon' }))).toEqual({
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
      targetType: 'salon',
    });
  });

  it('crosses a month end', () => {
    expect(toApiFilters(filters({ to: '2026-09-30' }))).toEqual({ to: '2026-09-30T21:00:00.000Z' });
  });
});
