import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { SALON_CARD } from './salon-card';

/** The card of one Салон, at `/salons/:salonId` — what is particular to it is `SALON_CARD`. */
@Component({
  selector: 'app-salon-card-page',
  imports: [ProfileCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-profile-card [kind]="card" [ids]="salonId()" />`,
})
export class SalonCardPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly salonId = input.required<string>();

  protected readonly card = SALON_CARD;
}
