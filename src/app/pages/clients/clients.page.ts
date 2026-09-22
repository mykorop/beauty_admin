import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { Observable } from 'rxjs';
import {
  CLIENT_STATUS_SEVERITY,
  type ClientListItem,
  type ClientStatus,
  ClientsClient,
} from '../../core/api/clients.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ProfileTablePage, type ProfileList } from '../../shared/profile-table/profile-table.page';
import { CLIENT_SORT_FIELDS, DEFAULT_CLIENTS_TABLE_STATE, type ClientSortField } from './clients-table-state';

/**
 * Every Клієнт on the platform — the same table as the Салони and the Незалежні майстри, minus the
 * columns a person does not have. It is opened from a support request, so the search box is the
 * screen: a name, an email or a phone number is what the person on the other end of the line gives.
 */
@Component({
  selector: 'app-clients-page',
  imports: [Button, FormsModule, IconField, InputIcon, InputText, RouterLink, Select, TableModule, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clients.page.html',
})
export class ClientsPage extends ProfileTablePage<ClientListItem, ClientSortField> {
  private readonly client = inject(ClientsClient);

  constructor() {
    super({ sortFields: CLIENT_SORT_FIELDS, defaults: DEFAULT_CLIENTS_TABLE_STATE, city: false });
  }

  protected fetch(options: { refresh: boolean }): Observable<ProfileList<ClientListItem>> {
    return this.client.list(options);
  }

  protected idOf(client: ClientListItem): string {
    return client.clientId;
  }

  // PrimeNG hands the row template an untyped `$implicit`; these give the row its types back.
  protected statusSeverity(status: ClientStatus): 'success' | 'warn' | 'danger' {
    return CLIENT_STATUS_SEVERITY[status];
  }

  protected statusLabelKey(status: ClientStatus): TranslationKey {
    return `profile.status.${status}`;
  }

  protected openClient(clientId: string, event: MouseEvent): void {
    // The name is a real link (middle-click, "open in new tab"); let it handle its own clicks.
    if (!(event.target as HTMLElement).closest('a')) {
      void this.router.navigate(['/clients', clientId]);
    }
  }
}
