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
import { type SalonListItem, SalonsClient, type SalonStatus } from '../../core/api/salons.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { PROFILE_STATUS_SEVERITY } from '../../shared/profile-status';
import { ProfileTablePage, type ProfileList } from '../../shared/profile-table/profile-table.page';
import { DEFAULT_TABLE_STATE, SALON_SORT_FIELDS, type SalonSortField } from './salons-table-state';

/**
 * Every Салон on the platform. The backend hands over the whole list; searching, filtering,
 * sorting and paging happen in `ProfileTablePage`, and the address — not the component — owns that
 * state, so a copied link reopens the same view.
 */
@Component({
  selector: 'app-salons-page',
  imports: [Button, FormsModule, IconField, InputIcon, InputText, RouterLink, Select, TableModule, Tag, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salons.page.html',
})
export class SalonsPage extends ProfileTablePage<SalonListItem, SalonSortField> {
  private readonly client = inject(SalonsClient);

  constructor() {
    super({ sortFields: SALON_SORT_FIELDS, defaults: DEFAULT_TABLE_STATE, city: true });
  }

  protected fetch(options: { refresh: boolean }): Observable<ProfileList<SalonListItem>> {
    return this.client.list(options);
  }

  protected idOf(salon: SalonListItem): string {
    return salon.salonId;
  }

  // PrimeNG hands the row template an untyped `$implicit`; these two give the status its type back.
  protected statusSeverity(status: SalonStatus): 'success' | 'warn' | 'danger' {
    return PROFILE_STATUS_SEVERITY[status];
  }

  protected statusLabelKey(status: SalonStatus): TranslationKey {
    return `profile.status.${status}`;
  }

  protected formatRating(rating: number): string {
    return new Intl.NumberFormat(this.i18n.locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(rating);
  }

  protected openSalon(salonId: string, event: MouseEvent): void {
    // The name is a real link (middle-click, "open in new tab"); let it handle its own clicks.
    if (!(event.target as HTMLElement).closest('a')) {
      void this.router.navigate(['/salons', salonId]);
    }
  }
}
