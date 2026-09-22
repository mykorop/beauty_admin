import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ClientsClient } from '../../core/api/clients.client';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { clientReviewsFeed } from '../../shared/reviews/reviews.feed';
import { ReviewsTable } from '../../shared/reviews/reviews.table';
import { ClientCardStore } from './client-card.store';

/**
 * Відгуки the Клієнт has written — **all** of them, прихованi included: the tab is read to judge
 * the person, and a відгук the platform itself took off the shop window is exactly what that
 * judgement is about. Приховати one from here is the same decision at the same address as from a
 * Салон's tab.
 */
@Component({
  selector: 'app-client-reviews-tab',
  imports: [ReviewsTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, like the Салон and Майстер twins.
  template: `
    @if (clientId) {
      <app-reviews [feed]="feed" [timezone]="timezone" />
    }
  `,
})
export class ClientReviewsTab {
  // The card renders its tabs only once the client is loaded, and rebuilds them for another one.
  protected readonly clientId = inject(ClientCardStore).client()?.clientId ?? '';
  protected readonly feed = clientReviewsFeed(inject(ClientsClient), this.clientId);
  /** His відгуки span venues, so they are dated on the platform's clock, never on one place's. */
  protected readonly timezone = PLATFORM_TIME_ZONE;
}
