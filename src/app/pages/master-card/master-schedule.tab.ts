import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { MastersClient } from '../../core/api/masters.client';
import { WorkingScheduleTab, type WorkingSchedulePort } from '../../shared/working-schedule/working-schedule.tab';
import { MasterCardStore } from './master-card.store';

/**
 * Робочий графік of a Незалежний майстер, in the same editor a Майстер салону is arranged with.
 *
 * `bounds: null` is the whole difference: nothing stands above him, so the week is shown alone, no
 * day is marked as sticking out, and the Салон hours read is not made at all (`domain.md` §1d
 * constrains a roster master only).
 */
@Component({
  selector: 'app-master-schedule-tab',
  imports: [WorkingScheduleTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, like the Майстер салону twin.
  template: `
    @if (masterId) {
      <app-working-schedule [port]="port" />
    }
  `,
})
export class MasterScheduleTab {
  private readonly client = inject(MastersClient);

  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  private readonly master = inject(MasterCardStore).master();
  protected readonly masterId = this.master?.masterId ?? '';

  protected readonly port: WorkingSchedulePort = {
    timezone: this.master?.timezone ?? 'UTC',
    /** The backend refuses every write to a Видалений майстер as well: `MASTER_DELETED`. */
    writable: this.master?.status !== 'deleted',
    read: (window) => this.client.schedule(this.masterId, window),
    bounds: null,
    saveWeek: (request) => this.client.updateHours(this.masterId, request).pipe(map((hours) => hours.days)),
    saveRotation: (request) =>
      this.client.updateSchedulePattern(this.masterId, request).pipe(map((stored) => stored.schedulePattern)),
    createTimeOff: (request) => this.client.createTimeOff(this.masterId, request),
    removeTimeOff: (groupId, reason) => this.client.removeTimeOff(this.masterId, groupId, reason),
  };
}
