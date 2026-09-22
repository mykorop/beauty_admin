import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MediaClient } from '../../core/api/media.client';
import { MediaTab } from '../../shared/media/media.tab';
import type { MediaPort } from '../../shared/media/media.model';
import { SalonCardStore } from './salon-card.store';

/**
 * «Фото й сертифікати» of a Салон. `deleteAvatar: null` — a Салон has no avatar of its own, its
 * picture is the first photo of its gallery.
 */
@Component({
  selector: 'app-salon-media-tab',
  imports: [MediaTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id: the card fills its store before it renders the tabs.
  template: `
    @if (salonId) {
      <app-media [port]="port" />
    }
  `,
})
export class SalonMediaTab {
  private readonly client = inject(MediaClient);

  // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
  private readonly salon = inject(SalonCardStore).salon();
  protected readonly salonId = this.salon?.salonId ?? '';

  protected readonly port: MediaPort = {
    timezone: this.salon?.timezone ?? 'UTC',
    writable: this.salon?.status !== 'deleted',
    load: () => this.client.salon(this.salonId),
    deleteImage: (imageUrl, reason) => this.client.deleteSalonImage(this.salonId, imageUrl, reason),
    deleteAvatar: null,
    deleteCertificate: (certificateId, reason) =>
      this.client.deleteSalonCertificate(this.salonId, certificateId, reason),
  };
}
