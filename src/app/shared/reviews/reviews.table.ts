import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button, ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { map } from 'rxjs';
import { REVIEW_STATES, ReviewsClient, type Review } from '../../core/api/reviews.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { feed } from '../feed';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import { formatVenueDateTime } from '../venue-date';
import type { ReviewFilterName, ReviewsFeed } from './reviews.feed';
import { NO_REVIEW_FILTERS, parseReviewFilters, toQueryParams, type ReviewFilters } from './review-filters';

/**
 * Відгуки of one Салон, of one Майстер, of one Майстер inside one Салон, or of one Клієнт: the
 * стрічка модерації and the «Відгуки» tab of every card, which are the same table.
 *
 * Whose reviews these are lives entirely in `feed` — its address, and which of the filters it can
 * be asked for; the filters themselves live in the address, so a view can be linked to. The one
 * thing the table does **not** offer is editing: a review's words and scores are the Клієнт's, and
 * the platform may only take them off the shop window.
 *
 * Every action answers with the whole review, so the row redraws from the answer rather than from a
 * re-read — a re-read under a state filter would make the row vanish from under the dialog that
 * just changed it.
 */
@Component({
  selector: 'app-reviews',
  imports: [Button, ButtonDirective, FormsModule, InputText, ReasonDialog, Select, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './reviews.table.html',
})
export class ReviewsTable {
  /** Whose reviews these are, and what the endpoint behind them accepts. */
  readonly feed = input.required<ReviewsFeed>();

  /**
   * The clock every row is printed on, and the one the day filters are cut on.
   *
   * Inside a card it is the venue's — the administrator talks to the owner about «вчора ввечері»
   * in the Салон's zone. On the наскрізна стрічка, which spans venues, it is the platform's. It is
   * never the browser's, which moves with whoever opens the link.
   */
  readonly timezone = input.required<string>();

  /** Moderation is one address whatever feed the review was found in (`/admin/reviews/{id}/…`). */
  private readonly client = inject(ReviewsClient);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** A control is drawn only when the open feed can actually be asked for it. */
  protected readonly shows = (filter: ReviewFilterName): boolean => this.feed().filters.includes(filter);

  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(parseReviewFilters)), {
    initialValue: parseReviewFilters(this.route.snapshot.queryParamMap),
  });
  protected readonly filtered = computed(() =>
    this.feed().filters.some((name) => this.filters()[name] !== null),
  );

  /**
   * A new feed or new filters, or «Оновити», start it over; a page asked under the old ones is
   * dropped.
   */
  protected readonly reviews = feed({
    query: () => ({ source: this.feed(), timezone: this.timezone(), filters: this.filters() }),
    read: ({ source, timezone, filters }, cursor) => source.list(filters, timezone, cursor),
  });
  /** Reviews an action has answered with since this list was read, by id: drawn as answered. */
  private readonly answered = this.reviews.listState<ReadonlyMap<string, Review>>(new Map());
  protected readonly busy = signal(false);
  /** The review whose confirmation is open, or `null`. */
  protected readonly asked = this.reviews.listState<Review | null>(null);

  protected readonly ratingOptions = [5, 4, 3, 2, 1].map((value) => ({
    value,
    label: String(value),
  }));
  protected readonly stateOptions = computed(() =>
    REVIEW_STATES.map((value) => ({ value, label: this.i18n.t(`reviews.state.${value}`) })),
  );

  protected readonly rows = computed(() => {
    const locale = this.i18n.locale();
    const timezone = this.timezone();
    return (
      this.reviews.items()?.map((row) => {
        const review = this.answered().get(row.reviewId) ?? row;
        return {
          review,
          when: formatVenueDateTime(review.createdAt, locale, timezone),
          masterRating: String(review.masterRating),
          // A visit to a Незалежний майстер rates no Салон; the equal number the row carries would
          // read as one.
          salonRating: review.salonId ? String(review.salonRating) : '—',
          hidden: review.hiddenAt !== null,
        };
      }) ?? null
    );
  });

  protected setFilter(change: Partial<ReviewFilters>): void {
    // A cleared date input reports '', a cleared select `null`.
    const normalised = Object.fromEntries(
      Object.entries(change).map(([key, value]) => [key, value === '' ? null : value]),
    );
    this.navigate({ ...this.filters(), ...normalised });
  }

  protected resetFilters(): void {
    this.navigate(NO_REVIEW_FILTERS);
  }

  protected ask(review: Review): void {
    this.asked.set(review);
  }

  protected closeUnless(visible: boolean): void {
    if (!visible) {
      this.asked.set(null);
    }
  }

  /**
   * One flight at a time, and the dialog closes only once the backend has agreed: a refusal — a
   * review somebody already hid, a rating race it gave up on — leaves it open with the reason as
   * typed, and the interceptor has already worded the code as a toast.
   */
  protected apply(review: Review, reason: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    const call = review.hiddenAt
      ? this.client.unhide(review.reviewId, reason || undefined)
      : this.client.hide(review.reviewId, reason);
    call.subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.asked.set(null);
        this.answered.update((answered) => new Map(answered).set(updated.reviewId, updated));
      },
      error: () => this.busy.set(false),
    });
  }

  private navigate(filters: ReviewFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(filters),
      queryParamsHandling: 'merge',
    });
  }
}
