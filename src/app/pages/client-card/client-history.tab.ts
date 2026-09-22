import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuditHistory } from '../../shared/audit/audit-history';
import { PLATFORM_TIME_ZONE } from '../../shared/platform-clock';
import { ClientCardStore } from './client-card.store';

/**
 * «Історія» of this Клієнт — the shared log reader, pointed at him. It is the shortest history the
 * panel has, and it is short by design: his profile is read-only, so the only rows that can ever
 * land in it are Блокування and its lifting.
 */
@Component({
  selector: 'app-client-history-tab',
  imports: [AuditHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (client(); as client) {
      <app-audit-history
        targetType="client"
        emptyKey="client.history.empty"
        [targetId]="client.clientId"
        [timezone]="platformTimeZone"
      />
    }
  `,
})
export class ClientHistoryTab {
  // The card renders its tabs only once the client is loaded, and rebuilds them for another one.
  protected readonly client = inject(ClientCardStore).client.asReadonly();
  /** A Клієнт belongs to no venue, so his rows are dated on the platform's own clock. */
  protected readonly platformTimeZone = PLATFORM_TIME_ZONE;
}
