import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MasterServicesClient } from '../../core/api/master-services.client';
import type { ServiceCatalogPort } from '../../shared/service-catalog/service-catalog.model';
import { ServiceCatalogTab } from '../../shared/service-catalog/service-catalog.tab';
import { MasterCardStore } from './master-card.store';

/**
 * Каталог послуг of a Незалежний майстер, in the same editor a Салон's Каталог is edited with.
 *
 * `copies: false` is the whole difference: there is no Ростер under this Каталог, so no Копії
 * майстра to count and no cascade to warn about — the price stored here is the one the Клієнт books.
 */
@Component({
  selector: 'app-master-services-tab',
  imports: [ServiceCatalogTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-service-catalog [port]="port" [writable]="writable" [copies]="false" />`,
})
export class MasterServicesTab {
  private readonly client = inject(MasterServicesClient);

  // The card renders its tabs only once the master is loaded, and rebuilds them for another one.
  private readonly master = inject(MasterCardStore).master();
  private readonly masterId = this.master?.masterId ?? '';

  /** The backend refuses every write to a Видалений майстер as well: `MASTER_DELETED`. */
  protected readonly writable = this.master?.status !== 'deleted';

  protected readonly port: ServiceCatalogPort = {
    list: () => this.client.catalog(this.masterId),
    get: (serviceId) => this.client.get(this.masterId, serviceId),
    create: (request) => this.client.create(this.masterId, request),
    update: (serviceId, request) => this.client.update(this.masterId, serviceId, request),
    deactivate: (serviceId) => this.client.deactivate(this.masterId, serviceId),
  };
}
