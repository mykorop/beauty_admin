import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProfileCard } from '../../shared/profile-card/profile-card';
import { CLIENT_CARD } from './client-card';

/** The card of one Клієнт, at `/clients/:clientId` — what is particular to it is `CLIENT_CARD`. */
@Component({
  selector: 'app-client-card-page',
  imports: [ProfileCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-profile-card [kind]="card" [ids]="clientId()" />`,
})
export class ClientCardPage {
  /** Bound from the route by `withComponentInputBinding()`. */
  readonly clientId = input.required<string>();

  protected readonly card = CLIENT_CARD;
}
