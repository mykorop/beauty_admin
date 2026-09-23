import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { AppointmentsTab } from '../../shared/appointments/appointments.tab';
import type { AppointmentsPort } from '../../shared/appointments/appointments.model';
import { MasterCardStore } from './master-card.store';

/**
 * Записи of a Незалежний майстер — the ones he took on his own, as his own calendar draws them.
 * `masters: null`: the list is already his, so neither the filter nor a column repeating his name
 * on every row would say anything.
 */
@Component({
  selector: 'app-master-appointments-tab',
  imports: [AppointmentsTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, like the Салон twin.
  template: `
    @if (masterId) {
      <app-appointments [port]="port" />
    }
  `,
})
export class MasterAppointmentsTab {
  private readonly client = inject(AppointmentsClient);

  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  private readonly master = inject(MasterCardStore).master();
  protected readonly masterId = this.master?.masterId ?? '';

  protected readonly port: AppointmentsPort = {
    timezone: this.master?.timezone ?? 'UTC',
    masters: null,
    list: (query) => this.client.master(this.masterId, query),
  };
}
