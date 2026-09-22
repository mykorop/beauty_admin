import { REVIEW_STATES, type ReviewState, type ReviewsQuery, type ReviewsScope } from '../../core/api/reviews.client';
import { addCalendarDays, parseCalendarDay } from '../calendar-day';
import { zonedDayStart } from '../platform-clock';

/** The filters of a reviews feed, as the address holds them; days are `YYYY-MM-DD`, both inclusive. */
export type ReviewFilters = {
  from: string | null;
  to: string | null;
  /** One exact score, 1–5. A range («оцінка ≤ 2») is not a question this filter can be asked. */
  rating: number | null;
  state: ReviewState | null;
};

export const NO_REVIEW_FILTERS: ReviewFilters = { from: null, to: null, rating: null, state: null };

type ParamReader = { get(name: string): string | null };

/** Anything a hand-edited address got wrong reads as "not set" rather than as a refusal. */
export function parseReviewFilters(params: ParamReader): ReviewFilters {
  const from = parseCalendarDay(params.get('from'));
  const to = parseCalendarDay(params.get('to'));
  const rating = Number(params.get('rating'));
  return {
    from,
    to: from && to && to < from ? null : to,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    state: REVIEW_STATES.find((value) => value === params.get('state')) ?? null,
  };
}

/** `null` makes the router drop the parameter, so a cleared filter leaves the address too. */
export function toQueryParams(filters: ReviewFilters): Record<string, string | number | null> {
  return { ...filters };
}

/**
 * What the backend is asked: the scope it may not be asked without, and the days as instants —
 * `from` inclusive, `to` exclusive.
 *
 * The clock is the caller's, because it differs by screen: inside a card it is the venue's, so
 * «21 вересня» means the day the Салон and its Клієнти lived; on the наскрізна стрічка, which
 * spans venues, it is the platform's. Getting it from the browser's would move the boundary under
 * whoever opens the link.
 */
export function toApiQuery(scope: ReviewsScope, filters: ReviewFilters, timeZone: string): ReviewsQuery {
  return {
    ...scope,
    ...(filters.from ? { from: zonedDayStart(filters.from, timeZone) } : {}),
    ...(filters.to ? { to: zonedDayStart(addCalendarDays(filters.to, 1), timeZone) } : {}),
    ...(filters.rating ? { rating: filters.rating } : {}),
    ...(filters.state ? { state: filters.state } : {}),
  };
}
