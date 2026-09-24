import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClientsClient } from '../../core/api/clients.client';
import { ReviewsClient } from '../../core/api/reviews.client';
import { cardScope } from '../profile-card/loaded-card';
import { clientReviewsFeed, entityReviewsFeed } from './reviews.feed';
import { ReviewsTable } from './reviews.table';

/**
 * «Відгуки» of a card: the moderation table, on the feed and the clock of the card's profile.
 *
 * A Салон's are every review left for a visit there, whichever Майстер served; a Незалежний
 * майстер's are **all** of his, those he earned in a Салон he has since left included — they are
 * what his own rating is computed from; a Майстер салону's are what he earned in this Салон. Each
 * is dated on the venue's clock. A Клієнт's are the ones he wrote — прихованi included, for they are
 * what the tab is read to judge — and span venues, so they are dated on the platform's.
 */
@Component({
  selector: 'app-reviews-tab',
  imports: [ReviewsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-reviews [feed]="feed" [timezone]="scope().timezone" />`,
})
export class ReviewsTab {
  protected readonly scope = cardScope();

  private readonly reviews = this.scope().reviews;
  protected readonly feed =
    'writtenBy' in this.reviews
      ? clientReviewsFeed(inject(ClientsClient), this.reviews.writtenBy)
      : entityReviewsFeed(inject(ReviewsClient), this.reviews.about);
}
