import type { Observable } from 'rxjs';
import type { ClientsClient } from '../../core/api/clients.client';
import type { ReviewsClient, ReviewsPage, ReviewsScope } from '../../core/api/reviews.client';
import { toApiQuery, type ReviewFilters } from './review-filters';

/** Which of the table's filters the endpoint behind a feed can be asked for. */
export type ReviewFilterName = keyof ReviewFilters;

/**
 * Where a page of відгуки comes from.
 *
 * The table knows nothing about whose reviews it is showing — it hands the feed the filters and a
 * cursor and draws whatever comes back. That is what lets one table serve the стрічка модерації,
 * the «Відгуки» tab of a Салон, of a Майстер, and the «Відгуки» tab of a Клієнт, whose reviews live
 * at an address of their own and answer to none of the filters.
 */
export type ReviewsFeed = {
  /** Only these controls are drawn; a feed that names none shows no filter row at all. */
  readonly filters: readonly ReviewFilterName[];
  list(filters: ReviewFilters, timeZone: string, cursor?: string): Observable<ReviewsPage>;
};

/** Everything the entity feed (`GET /admin/reviews`) can be narrowed by. */
const ENTITY_FILTERS: readonly ReviewFilterName[] = ['from', 'to', 'rating', 'state'];

/**
 * The відгуки of one Салон, one Майстер, or one Майстер inside one Салон. The entity is mandatory:
 * the table has no «every review by time» partition, so a feed without one could only be a Scan.
 */
export function entityReviewsFeed(client: ReviewsClient, scope: ReviewsScope): ReviewsFeed {
  return {
    filters: ENTITY_FILTERS,
    list: (filters, timeZone, cursor) => client.list(toApiQuery(scope, filters, timeZone), cursor),
  };
}

/**
 * Everything one Клієнт has written, прихованi included — his own partition, at his own address.
 *
 * **No filters**, and not an omission: `rating` is «the score of the entity being read», and the
 * entity read here is the person who gave both scores, so it would have to mean two things at
 * once. Dates and state are narrowings the backend does not offer on this feed either — a person's
 * own list is short enough to read whole.
 */
export function clientReviewsFeed(client: ClientsClient, clientId: string): ReviewsFeed {
  return {
    filters: [],
    list: (_filters, _timeZone, cursor) => client.reviews(clientId, cursor),
  };
}
