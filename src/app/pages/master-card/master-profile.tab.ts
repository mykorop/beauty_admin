import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { MasterStatus } from '../../core/api/masters.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { cardDates, loadedCard } from '../../shared/profile-card/loaded-card';
import { formatRating } from '../../shared/rating';
import { specializationLabel } from '../../shared/specialization';
import { MASTER_CARD } from './master-card';
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
  private readonly dates = cardDates();
  private readonly card = loadedCard(MASTER_CARD);
  protected readonly profile = this.card.profile;
  protected readonly scope = this.card.scope;
  protected readonly editing = signal(false);

  protected readonly addressLines = computed(() => {
    const master = this.profile();
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
    const master = this.profile();
    return master.locationLatitude && master.locationLongitude
      ? `${master.locationLatitude}, ${master.locationLongitude}`
      : '—';
  });

  protected readonly specialization = computed(() =>
    specializationLabel(this.i18n, this.profile().specialization),
  );

  protected readonly rating = computed(() => {
    const master = this.profile();
    return formatRating(this.i18n.locale(), master.rating, master.reviewCount);
  });

  /** The former Салон may itself be Заблокований or Видалений; the card says so beside its name. */
  protected salonStatusKey(status: MasterStatus): TranslationKey {
    return `profile.status.${status}`;
  }

  protected readonly createdAt = computed(() => this.dates.dateTime(this.profile().createdAt));
  protected readonly updatedAt = computed(() => this.dates.dateTime(this.profile().updatedAt));
  protected readonly joinedAt = computed(() => this.dates.day(this.profile().salon?.joinedAt));
  protected readonly leftAt = computed(() => this.dates.day(this.profile().salon?.leftAt));
}
