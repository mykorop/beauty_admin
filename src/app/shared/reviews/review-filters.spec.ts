import { NO_REVIEW_FILTERS, parseReviewFilters, toApiQuery, toQueryParams, type ReviewFilters } from './review-filters';

const params = (values: Record<string, string>) => ({
  get: (name: string) => values[name] ?? null,
});
const filters = (overrides: Partial<ReviewFilters>): ReviewFilters => ({
  ...NO_REVIEW_FILTERS,
  ...overrides,
});

describe('parseReviewFilters', () => {
  it('reads an empty address as no filters', () => {
    expect(parseReviewFilters(params({}))).toEqual(NO_REVIEW_FILTERS);
  });

  it('reads every filter from the address', () => {
    expect(parseReviewFilters(params({ from: '2026-09-01', to: '2026-09-21', rating: '2', state: 'hidden' }))).toEqual({
      from: '2026-09-01',
      to: '2026-09-21',
      rating: 2,
      state: 'hidden',
    });
  });

  it('drops what a hand-edited address got wrong', () => {
    expect(parseReviewFilters(params({ from: '01.09.2026', to: '2026-02-31', rating: '9', state: 'burnt' }))).toEqual(
      NO_REVIEW_FILTERS,
    );
  });

  it('drops a fractional rating, which is not a score anyone left', () => {
    expect(parseReviewFilters(params({ rating: '4.5' }))).toEqual(NO_REVIEW_FILTERS);
  });

  it('drops an end that precedes the start', () => {
    expect(parseReviewFilters(params({ from: '2026-09-10', to: '2026-09-01' }))).toEqual(
      filters({ from: '2026-09-10' }),
    );
  });
});

describe('toQueryParams', () => {
  it('writes unset filters as null so the router removes them', () => {
    expect(toQueryParams(filters({ state: 'hidden' }))).toEqual({
      from: null,
      to: null,
      rating: null,
      state: 'hidden',
    });
  });

  it('round-trips through parse', () => {
    const state = filters({ from: '2026-09-01', rating: 1 });
    const written = toQueryParams(state);
    expect(
      parseReviewFilters({
        get: (name) => (written[name] === null ? null : String(written[name])),
      }),
    ).toEqual(state);
  });
});

describe('toApiQuery', () => {
  const CHISINAU = 'Europe/Chisinau';

  /** The scope is what the backend may not be asked without, so it travels even with no filters. */
  it('always carries the scope', () => {
    expect(toApiQuery({ salonId: 'salon-1' }, NO_REVIEW_FILTERS, CHISINAU)).toEqual({ salonId: 'salon-1' });
  });

  it('keeps a Майстер inside a Салон — the «Відгуки» tab of a Майстер салону', () => {
    expect(toApiQuery({ salonId: 'salon-1', masterId: 'master-1' }, NO_REVIEW_FILTERS, CHISINAU)).toEqual({
      salonId: 'salon-1',
      masterId: 'master-1',
    });
  });

  it('turns the days into instants on the clock it was given, the last day included in full', () => {
    expect(toApiQuery({ masterId: 'master-1' }, filters({ from: '2026-09-01', to: '2026-09-21' }), CHISINAU)).toEqual({
      masterId: 'master-1',
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
    });
  });

  /**
   * A card's tab asks about the venue's days, not the platform's. A Салон in another zone would
   * otherwise lose the reviews of its own last evening off the end of the window.
   */
  it('cuts the window on the venue’s clock when that is the one it was handed', () => {
    expect(
      toApiQuery({ salonId: 'salon-1' }, filters({ from: '2026-09-01', to: '2026-09-01' }), 'America/Los_Angeles'),
    ).toEqual({
      salonId: 'salon-1',
      from: '2026-09-01T07:00:00.000Z',
      to: '2026-09-02T07:00:00.000Z',
    });
  });

  it('sends the rating and the state as the backend spells them', () => {
    expect(toApiQuery({ salonId: 'salon-1' }, filters({ rating: 2, state: 'visible' }), CHISINAU)).toEqual({
      salonId: 'salon-1',
      rating: 2,
      state: 'visible',
    });
  });
});
