import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReviewsClient, type ReviewsScope } from '../../core/api/reviews.client';
import { entityReviewsFeed } from '../../shared/reviews/reviews.feed';
import { ReviewsTable } from '../../shared/reviews/reviews.table';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterStore } from './salon-master.store';

/**
 * Відгуки of a Майстер салону: what he earned **in this Салон**. His reviews from elsewhere belong
 * to whatever card that place is, and it is this Салон's link whose rating they feed here.
 */
@Component({
  selector: 'app-salon-master-reviews-tab',
  imports: [ReviewsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on both ids, like the rest of this card's tabs.
  template: `
    @if (scope.salonId && scope.masterId) {
      <app-reviews [feed]="feed" [timezone]="timezone" />
    }
  `,
})
export class SalonMasterReviewsTab {
  // The card renders its tabs only once the salon and the master are loaded.
  private readonly salon = inject(SalonCardStore).salon();
  protected readonly scope: ReviewsScope = {
    salonId: this.salon?.salonId ?? '',
    masterId: inject(SalonMasterStore).master()?.masterId ?? '',
  };
  protected readonly feed = entityReviewsFeed(inject(ReviewsClient), this.scope);
  /** The Салон's clock: the visits these reviews are about happened on it. */
  protected readonly timezone = this.salon?.timezone ?? 'UTC';
}
