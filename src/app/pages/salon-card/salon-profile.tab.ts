import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SalonCardStore } from './salon-card.store';

/** Профіль of the Салон, read-only. Dates are the salon's clock, never the browser's. */
@Component({
  selector: 'app-salon-profile-tab',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-profile.tab.html',
})
export class SalonProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(SalonCardStore);
  protected readonly salon = this.store.salon.asReadonly();

  protected readonly addressLines = computed(() => {
    const salon = this.salon();
    if (!salon) {
      return [];
    }
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
    const salon = this.salon();
    return salon?.locationLatitude && salon.locationLongitude
      ? `${salon.locationLatitude}, ${salon.locationLongitude}`
      : '—';
  });

  protected readonly rating = computed(() => {
    const salon = this.salon();
    return salon && salon.reviewCount > 0
      ? new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
          salon.rating,
        )
      : '—';
  });

  protected readonly createdAt = computed(() => this.store.venueDate(this.salon()?.createdAt));
  protected readonly updatedAt = computed(() => this.store.venueDate(this.salon()?.updatedAt));
}
