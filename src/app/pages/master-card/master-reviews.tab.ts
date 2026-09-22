import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReviewsClient, type ReviewsScope } from '../../core/api/reviews.client';
import { entityReviewsFeed } from '../../shared/reviews/reviews.feed';
import { ReviewsTable } from '../../shared/reviews/reviews.table';
import { MasterCardStore } from './master-card.store';

/**
 * Відгуки of a Незалежний майстер — **all** of them, including those he earned in a Салон he has
 * since left: they are what his own profile's rating is computed from, so the tab that moderates
 * that rating has to show the same set.
 */
@Component({
  selector: 'app-master-reviews-tab',
  imports: [ReviewsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, like the Салон twin.
  template: `
    @if (scope.masterId) {
      <app-reviews [feed]="feed" [timezone]="timezone" />
    }
  `,
})
export class MasterReviewsTab {
  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  private readonly master = inject(MasterCardStore).master();
  protected readonly scope: ReviewsScope = { masterId: this.master?.masterId ?? '' };
  protected readonly feed = entityReviewsFeed(inject(ReviewsClient), this.scope);
  /** His own clock — he is his own place. */
  protected readonly timezone = this.master?.timezone ?? 'UTC';
}
