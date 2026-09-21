import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { MasterStatus } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { formatRating } from '../../shared/rating';
import { specializationLabel } from '../../shared/specialization';
import { MasterCardStore } from './master-card.store';
import { MasterProfileForm } from './master-profile.form';

/**
 * Профіль of the Незалежний майстер: read first, edited on demand — never a Видалений one. Dates
 * are the master's own clock, never the browser's.
 */
@Component({
  selector: 'app-master-profile-tab',
  imports: [ButtonDirective, MasterProfileForm, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-profile.tab.html',
})
export class MasterProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(MasterCardStore);
  protected readonly master = this.store.master.asReadonly();
  protected readonly editing = signal(false);

  protected readonly addressLines = computed(() => {
    const master = this.master();
    if (!master) {
      return [];
    }
    return [
      [master.addressStreet, master.addressHouseNumber],
      [master.addressZipCode, master.addressCity],
      // The region repeats the city for Chișinău and Bălți; say it once.
      [master.addressState === master.addressCity ? '' : master.addressState, master.addressCountry],
    ]
      .map((parts) => parts.filter(Boolean).join(' '))
      .filter(Boolean);
  });

  protected readonly coordinates = computed(() => {
    const master = this.master();
    return master?.locationLatitude && master.locationLongitude
      ? `${master.locationLatitude}, ${master.locationLongitude}`
      : '—';
  });

  protected readonly specialization = computed(() =>
    specializationLabel(this.i18n, this.master()?.specialization ?? ''),
  );

  protected readonly rating = computed(() => {
    const master = this.master();
    return master ? formatRating(this.i18n.locale(), master.rating, master.reviewCount) : '—';
  });

  /** The former Салон may itself be Заблокований or Видалений; the card says so beside its name. */
  protected salonStatusKey(status: MasterStatus): TranslationKey {
    return `profile.status.${status}`;
  }

  protected readonly createdAt = computed(() => this.store.venueDate(this.master()?.createdAt));
  protected readonly updatedAt = computed(() => this.store.venueDate(this.master()?.updatedAt));
  protected readonly joinedAt = computed(() => this.store.venueDay(this.master()?.salon?.joinedAt));
  protected readonly leftAt = computed(() => this.store.venueDay(this.master()?.salon?.leftAt));
}
