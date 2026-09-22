import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { ReviewsScope } from '../../core/api/reviews.client';
import { ReviewsTable } from '../../shared/reviews/reviews.table';
import { SalonCardStore } from './salon-card.store';

/**
 * Відгуки of the Салон — every review left for a visit here, whichever Майстер served and whether
 * he is still on the Ростер: the review is about this place.
 */
@Component({
  selector: 'app-salon-reviews-tab',
  imports: [ReviewsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id: the card fills its store before it renders the tabs, and a tab built
  // without one would ask for a feed the backend refuses.
  template: `
    @if (scope.salonId) {
      <app-reviews [scope]="scope" [timezone]="timezone" />
    }
  `,
})
export class SalonReviewsTab {
  // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
  private readonly salon = inject(SalonCardStore).salon();
  protected readonly scope: ReviewsScope = { salonId: this.salon?.salonId ?? '' };
  /** The Салон's own clock: a review is dated by the day its Клієнт and its Салон both lived. */
  protected readonly timezone = this.salon?.timezone ?? 'UTC';
}
