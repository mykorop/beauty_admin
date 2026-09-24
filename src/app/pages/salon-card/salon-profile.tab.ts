import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { cardDates, loadedCard } from '../../shared/profile-card/loaded-card';
import { formatRating } from '../../shared/rating';
import { SALON_CARD } from './salon-card';
import { SalonProfileForm } from './salon-profile.form';

/**
 * Профіль of the Салон: read first, edited on demand — never a Видалений one. Dates are the salon's
 * clock, never the browser's.
 */
@Component({
  selector: 'app-salon-profile-tab',
  imports: [ButtonDirective, SalonProfileForm, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-profile.tab.html',
})
export class SalonProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly dates = cardDates();
  private readonly card = loadedCard(SALON_CARD);
  protected readonly profile = this.card.profile;
  protected readonly scope = this.card.scope;
  protected readonly editing = signal(false);

  protected readonly addressLines = computed(() => {
    const salon = this.profile();
    return [
      [salon.addressStreet, salon.addressHouseNumber],
      [salon.addressZipCode, salon.addressCity],
      // The region repeats the city for Chișinău and Bălți; say it once.
      [salon.addressState === salon.addressCity ? '' : salon.addressState, salon.addressCountry],
    ]
      .map((parts) => parts.filter(Boolean).join(' '))
      .filter(Boolean);
  });

  protected readonly coordinates = computed(() => {
    const salon = this.profile();
    return salon.locationLatitude && salon.locationLongitude
      ? `${salon.locationLatitude}, ${salon.locationLongitude}`
      : '—';
  });

  protected readonly rating = computed(() => {
    const salon = this.profile();
    return formatRating(this.i18n.locale(), salon.rating, salon.reviewCount);
  });

  protected readonly createdAt = computed(() => this.dates.dateTime(this.profile().createdAt));
  protected readonly updatedAt = computed(() => this.dates.dateTime(this.profile().updatedAt));
}
