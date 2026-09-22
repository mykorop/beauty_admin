import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { SalonMastersClient } from '../../core/api/salon-masters.client';
import { SalonsClient } from '../../core/api/salons.client';
import { WorkingScheduleTab, type WorkingSchedulePort } from '../../shared/working-schedule/working-schedule.tab';
import { SalonCardStore } from '../salon-card/salon-card.store';
import { SalonMasterStore } from './salon-master.store';

/**
 * Робочий графік of a Майстер салону, in the shared editor. This tab is what knows about the Салон:
 * it hands the editor the Години роботи the week has to stay inside (`domain.md` §1d) and the calls
 * that write, both scoped to this Салон.
 */
@Component({
  selector: 'app-salon-master-schedule-tab',
  imports: [WorkingScheduleTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on both ids, as this tab was before the editor moved.
  template: `
    @if (salonId && masterId) {
      <app-working-schedule [port]="port" />
    }
  `,
})
export class SalonMasterScheduleTab {
  private readonly client = inject(SalonMastersClient);
  private readonly salons = inject(SalonsClient);
  private readonly salonStore = inject(SalonCardStore);

  // The card renders its tabs only once the salon and the master are loaded, and rebuilds them for
  // another pair.
  private readonly salon = this.salonStore.salon();
  protected readonly salonId = this.salon?.salonId ?? '';
  protected readonly masterId = inject(SalonMasterStore).master()?.masterId ?? '';

  protected readonly port: WorkingSchedulePort = {
    timezone: this.salon?.timezone ?? 'UTC',
    /** The backend refuses every write in a Видалений salon as well: `SALON_DELETED`. */
    writable: this.salon?.status !== 'deleted',
    read: (window) => this.client.schedule(this.salonId, this.masterId, window),
    bounds: this.salons.hours(this.salonId).pipe(map((hours) => hours.days)),
    saveWeek: (request) =>
      this.client.updateHours(this.salonId, this.masterId, request).pipe(map((hours) => hours.days)),
    saveRotation: (request) =>
      this.client
        .updateSchedulePattern(this.salonId, this.masterId, request)
        .pipe(map((stored) => stored.schedulePattern)),
    createTimeOff: (request) => this.client.createTimeOff(this.salonId, this.masterId, request),
    removeTimeOff: (groupId, reason) => this.client.removeTimeOff(this.salonId, this.masterId, groupId, reason),
  };
}
