import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SalonServicesClient } from '../../core/api/salon-services.client';
import { ServiceCatalogTab } from '../../shared/service-catalog/service-catalog.tab';
import type { ServiceCatalogPort } from '../../shared/service-catalog/service-catalog.model';
import { SalonCardStore } from './salon-card.store';

/**
 * Каталог послуг of the Салон, in the shared editor: every service, deactivated ones included, with
 * how many Майстри hold a Копія of it. This tab is what knows about the Салон — the editor is
 * handed the four calls and the one fact that makes this Каталог a Салон's: Копії exist under it.
 */
@Component({
  selector: 'app-salon-services-tab',
  imports: [ServiceCatalogTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Guarded on the id, as this tab was before the editor moved: the card fills its store before it
  // renders the tabs, and a tab built without one would ask `/admin/salons//services`.
  template: `
    @if (salonId) {
      <app-service-catalog [port]="port" [writable]="writable()" [copies]="true" />
    }
  `,
})
export class SalonServicesTab {
  private readonly store = inject(SalonCardStore);
  private readonly client = inject(SalonServicesClient);

  // The card renders its tabs only once the salon is loaded, and rebuilds them for another one.
  protected readonly salonId = this.store.salon()?.salonId ?? '';

  /** The backend refuses every write in a Видалений salon as well: `SALON_DELETED`. */
  protected readonly writable = computed(() => this.store.salon()?.status !== 'deleted');

  protected readonly port: ServiceCatalogPort = {
    list: () => this.client.catalog(this.salonId),
    get: (serviceId) => this.client.get(this.salonId, serviceId),
    create: (request) => this.client.create(this.salonId, request),
    update: (serviceId, request) => this.client.update(this.salonId, serviceId, request),
    deactivate: (serviceId) => this.client.deactivate(this.salonId, serviceId),
  };
}
