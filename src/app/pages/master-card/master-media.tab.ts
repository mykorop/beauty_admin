import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaClient } from '../../core/api/media.client';
import { MediaTab } from '../../shared/media/media.tab';
import type { MediaPort } from '../../shared/media/media.model';
import { MasterCardStore } from './master-card.store';

/**
 * «Фото й сертифікати» of a Незалежний майстер — the one profile that has an avatar of its own to
 * moderate. A Майстер салону's avatar lives on his roster link, and his card has no such tab.
 */
@Component({
  selector: 'app-master-media-tab',
  imports: [MediaTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, like the Салон twin.
  template: `
    @if (masterId) {
      <app-media [port]="port" />
    }
  `,
})
export class MasterMediaTab {
  private readonly client = inject(MediaClient);

  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  private readonly master = inject(MasterCardStore).master();
  protected readonly masterId = this.master?.masterId ?? '';

  protected readonly port: MediaPort = {
    timezone: this.master?.timezone ?? 'UTC',
    writable: this.master?.status !== 'deleted',
    load: () => this.client.master(this.masterId),
    deleteImage: (imageUrl, reason) => this.client.deleteMasterImage(this.masterId, imageUrl, reason),
    deleteAvatar: (reason) => this.client.deleteMasterAvatar(this.masterId, reason),
    deleteCertificate: (certificateId, reason) =>
      this.client.deleteMasterCertificate(this.masterId, certificateId, reason),
  };
}
