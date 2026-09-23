import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuditHistory } from '../../shared/audit/audit-history';
import { MasterCardStore } from './master-card.store';

/**
 * «Історія» of this Майстер — the shared log reader, pointed at him. The partition is the master's
 * own, so the rows written while he was on a Ростер are here too: the history outlives the Салон.
 */
@Component({
  selector: 'app-master-history-tab',
  imports: [AuditHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (master(); as master) {
      <app-audit-history
        targetType="master"
        emptyKey="master.history.empty"
        [targetId]="master.masterId"
        [timezone]="master.timezone"
      />
    }
  `,
})
export class MasterHistoryTab {
  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  protected readonly master = inject(MasterCardStore).master;
}
