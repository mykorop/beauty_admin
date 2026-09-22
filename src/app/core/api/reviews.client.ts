import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** Видимий or прихований — the two states of a відгук, and the two values of the state filter. */
export const REVIEW_STATES = ['visible', 'hidden'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/**
 * One відгук as the moderation feed and the «Відгуки» tab of a card read it.
 *
 * Both scores travel, always: a visit to a Салон is rated twice — the Салон and the Майстер who
 * served — and the moderator settling a complaint needs to see which of the two the words are
 * about. For a visit to a Незалежний майстер the two are the same number.
 */
export type Review = {
  reviewId: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  masterId: string;
  /** `null` for a visit to a Незалежний майстер: there is no Салон behind it. */
  salonId: string | null;
  masterRating: number;
  salonRating: number;
  comment: string;
  createdAt: string;
  /** When an administrator hid it, and why — both `null` while the review is visible. */
  hiddenAt: string | null;
  hiddenReason: string | null;
};

export type ReviewsPage = { items: Review[]; nextCursor: string | null };

/**
 * Whose feed is being read. **One of the two ids is required** — the backend refuses a query that
 * names neither, because a review row's three index keys are all spoken for and there is no «every
 * review by time» partition behind «усі відгуки платформи». Both together is the «Відгуки» tab of
 * a Майстер салону: what he earned in that Салон.
 */
export type ReviewsScope = { salonId?: string; masterId?: string };

/** `from` inclusive, `to` exclusive — both instants, as the Журнал дій filters are. */
export type ReviewsQuery = ReviewsScope & {
  from?: string;
  to?: string;
  /** An exact score of the entity being read: the Майстер's when he is named, the Салон's otherwise. */
  rating?: number;
  state?: ReviewState;
};

/**
 * Відгуки as the panel reads and moderates them. There is deliberately nothing here that **edits**
 * one: the platform takes a review off the shop window and never rewrites what a Клієнт said, and
 * the backend has no endpoint for it either.
 */
@Injectable({ providedIn: 'root' })
export class ReviewsClient {
  private readonly http = inject(HttpClient);

  list(query: ReviewsQuery, cursor?: string): Observable<ReviewsPage> {
    return this.http.get<ReviewsPage>(adminApiUrl('/admin/reviews'), {
      params: {
        ...Object.fromEntries(
          Object.entries(query)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => [key, String(value)]),
        ),
        ...(cursor ? { cursor } : {}),
      },
    });
  }

  /**
   * Приховати with a mandatory reason. Answers with the review, so the row that asked redraws from
   * the answer rather than from what it hoped the action did.
   */
  hide(reviewId: string, reason: string): Observable<Review> {
    return this.http.post<Review>(adminApiUrl(`/admin/reviews/${encodeURIComponent(reviewId)}/hide`), { reason });
  }

  /** Its lighter twin: returning a review may say why, but need not. */
  unhide(reviewId: string, reason?: string): Observable<Review> {
    return this.http.post<Review>(
      adminApiUrl(`/admin/reviews/${encodeURIComponent(reviewId)}/unhide`),
      reason ? { reason } : {},
    );
  }
}
