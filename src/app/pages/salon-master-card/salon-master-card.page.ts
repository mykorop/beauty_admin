import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { SALON_MASTER_CARD } from './salon-master-card';

/**
 * The card of one Майстер салону, at `/salons/:salonId/masters/:masterId` — what is particular to
 * it is `SALON_MASTER_CARD`.
 */
@Component({
  selector: 'app-salon-master-card-page',
  imports: [ProfileCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-profile-card
    [kind]="card"
    [ids]="{ salonId: salonId(), masterId: masterId() }"
  />`,
})
export class SalonMasterCardPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();
  readonly masterId = input.required<string>();

  protected readonly card = SALON_MASTER_CARD;
}
