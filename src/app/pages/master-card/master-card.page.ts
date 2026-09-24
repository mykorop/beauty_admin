import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { MASTER_CARD } from './master-card';

/**
 * The card of one Незалежний майстер, at `/independent-masters/:masterId` — what is particular to
 * it is `MASTER_CARD`.
 */
@Component({
  selector: 'app-master-card-page',
  imports: [ProfileCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-profile-card [kind]="card" [ids]="masterId()" />`,
})
export class MasterCardPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly masterId = input.required<string>();

  protected readonly card = MASTER_CARD;
}
