import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { AppointmentsClient } from '../../core/api/appointments.client';
import { SalonMastersClient } from '../../core/api/salon-masters.client';
import { AppointmentsTab } from '../../shared/appointments/appointments.tab';
import type { AppointmentsPort } from '../../shared/appointments/appointments.model';
import { SalonCardStore } from './salon-card.store';

/**
 * Записи of the Салон, in the shared table: every Майстер of the Ростер, the ones who have since
 * left included. This tab is what knows about the Салон — it hands the table the Ростер to narrow
 * the list by, which is the one filter a Майстер's own tab has no use for.
 */
@Component({
  selector: 'app-salon-appointments-tab',
  imports: [AppointmentsTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id: the card fills its store before it renders the tabs, and a tab built
  // without one would ask `/admin/salons//appointments`.
  template: `
    @if (salonId) {
      <app-appointments [port]="port" />
    }
  `,
})
export class SalonAppointmentsTab {
  private readonly client = inject(AppointmentsClient);
  private readonly masters = inject(SalonMastersClient);

  // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
  private readonly salon = inject(SalonCardStore).salon();
  protected readonly salonId = this.salon?.salonId ?? '';

  protected readonly port: AppointmentsPort = {
    timezone: this.salon?.timezone ?? 'UTC',
    masters: this.masters
      .roster(this.salonId)
      .pipe(map((roster) => roster.items.map(({ masterId, masterName }) => ({ masterId, masterName })))),
    list: (query) => this.client.salon(this.salonId, query),
    details: (appointmentId) => this.client.details(appointmentId),
  };
}
