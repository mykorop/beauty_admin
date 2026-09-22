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
  MASTER_STATUS_SEVERITY,
  type MasterListItem,
  type MasterStatus,
  MastersClient,
} from '../../core/api/masters.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ProfileTablePage, type ProfileList } from '../../shared/profile-table/profile-table.page';
import { specializationLabel } from '../../shared/specialization';
import { DEFAULT_MASTERS_TABLE_STATE, MASTER_SORT_FIELDS, type MasterSortField } from './masters-table-state';

/**
 * Every Незалежний майстер on the platform — the same table as the Салони, down to the address
 * carrying its state. A Майстер салону is not here: he is read from the Ростер of his Салон.
 */
@Component({
  selector: 'app-masters-page',
  imports: [Button, FormsModule, IconField, InputIcon, InputText, RouterLink, Select, TableModule, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './masters.page.html',
})
export class MastersPage extends ProfileTablePage<MasterListItem, MasterSortField> {
  private readonly client = inject(MastersClient);

  constructor() {
    super({ sortFields: MASTER_SORT_FIELDS, defaults: DEFAULT_MASTERS_TABLE_STATE, city: true });
  }

  protected fetch(options: { refresh: boolean }): Observable<ProfileList<MasterListItem>> {
    return this.client.list(options);
  }

  protected idOf(master: MasterListItem): string {
    return master.masterId;
  }

  /** The column shows the translated specialization, so it sorts by that, not by the stored code. */
  protected override sortValue(master: MasterListItem, field: MasterSortField): unknown {
    return field === 'specialization' ? this.specialization(master.specialization) : master[field];
  }

  // PrimeNG hands the row template an untyped `$implicit`; these give the row its types back.
  protected statusSeverity(status: MasterStatus): 'success' | 'warn' | 'danger' {
    return MASTER_STATUS_SEVERITY[status];
  }

  protected statusLabelKey(status: MasterStatus): TranslationKey {
    return `profile.status.${status}`;
  }

  protected specialization(specialization: string): string {
    return specializationLabel(this.i18n, specialization);
  }

  protected formatRating(rating: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(rating);
  }

  protected openMaster(masterId: string, event: MouseEvent): void {
    // The name is a real link (middle-click, "open in new tab"); let it handle its own clicks.
    if (!(event.target as HTMLElement).closest('a')) {
      void this.router.navigate(['/independent-masters', masterId]);
    }
  }
}
