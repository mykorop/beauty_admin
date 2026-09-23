import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuditHistory } from '../../shared/audit/audit-history';
import { SalonCardStore } from './salon-card.store';

/** «Історія» of this Салон — the shared log reader, pointed at the salon the card is about. */
@Component({
  selector: 'app-salon-history-tab',
  imports: [AuditHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (salon(); as salon) {
      <app-audit-history
        targetType="salon"
        emptyKey="history.empty"
        [targetId]="salon.salonId"
        [timezone]="salon.timezone"
      />
    }
  `,
})
export class SalonHistoryTab {
  // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
  protected readonly salon = inject(SalonCardStore).salon;
}
