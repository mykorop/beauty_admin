import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { AppointmentsTab } from '../../shared/appointments/appointments.tab';
import type { AppointmentsPort } from '../../shared/appointments/appointments.model';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterStore } from './salon-master.store';

/**
 * Записи of a Майстер салону: his Салон's list, pinned to him. It is the Салон that answers for
 * them — the Запис was taken there, on its clock — so the read is the Салон's own, narrowed by
 * `masterId`, and never `/admin/masters/{masterId}/appointments`, which is a Незалежний майстер's
 * address and refuses him.
 */
@Component({
  selector: 'app-salon-master-appointments-tab',
  imports: [AppointmentsTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on both ids, like the rest of this card's tabs.
  template: `
    @if (salonId && masterId) {
      <app-appointments [port]="port" />
    }
  `,
})
export class SalonMasterAppointmentsTab {
  private readonly client = inject(AppointmentsClient);

  // The card renders its tabs only once the salon and the master are loaded.
  private readonly salon = inject(SalonCardStore).salon();
  protected readonly salonId = this.salon?.salonId ?? '';
  protected readonly masterId = inject(SalonMasterStore).master()?.masterId ?? '';

  protected readonly port: AppointmentsPort = {
    timezone: this.salon?.timezone ?? 'UTC',
    masters: null,
    list: (query) => this.client.salon(this.salonId, { ...query, masterId: this.masterId }),
    details: (appointmentId) => this.client.details(appointmentId),
  };
}
