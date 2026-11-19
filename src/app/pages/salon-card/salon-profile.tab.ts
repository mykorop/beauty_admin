import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { type Salon, SalonsClient } from '../../core/api/salons.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { cardDates, loadedCard } from '../../shared/profile-card/loaded-card';
import { formatRating } from '../../shared/rating';
import { reasonAction } from '../../shared/reason-dialog/reason-action';
import { ReasonDialog } from '../../shared/reason-dialog/reason-dialog';
import { SALON_CARD } from './salon-card';
import { SalonProfileForm } from './salon-profile.form';

/**
 * The words of one direction of «SMS-сповіщення клієнтам», spelled out rather than assembled from a
 * prefix — as `BlockAction`'s are — so a mistyped key fails the compiler, not the screen.
 */
type SmsCopy = {
  title: TranslationKey;
  message: TranslationKey;
  confirm: TranslationKey;
  done: TranslationKey;
  /** Turning SMS off takes something away from the Клієнти; turning them on does not. */
  severity: 'primary' | 'danger';
};

const SMS_ENABLE_COPY: SmsCopy = {
  title: 'salon.sms.enable.title',
  message: 'salon.sms.enable.message',
  confirm: 'salon.sms.enable.confirm',
  done: 'salon.sms.enable.done',
  severity: 'primary',
};

const SMS_DISABLE_COPY: SmsCopy = {
  title: 'salon.sms.disable.title',
  message: 'salon.sms.disable.message',
  confirm: 'salon.sms.disable.confirm',
  done: 'salon.sms.disable.done',
  severity: 'danger',
};

const smsCopyOf = (enabled: boolean): SmsCopy => (enabled ? SMS_ENABLE_COPY : SMS_DISABLE_COPY);

/**
 * Профіль of the Салон: read first, edited on demand — never a Видалений one. Dates are the salon's
 * clock, never the browser's.
 *
 * «SMS-сповіщення клієнтам» sits among its data but is not part of the edit form: it is the
 * platform's decision rather than the owner's data, it has an action and a Журнал name of its own,
 * and it is taken through the «дія з причиною» dialog — with a reason the administrator may leave
 * out.
 */
@Component({
  selector: 'app-salon-profile-tab',
  imports: [ButtonDirective, Checkbox, FormsModule, ReasonDialog, SalonProfileForm, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salon-profile.tab.html',
})
export class SalonProfileTab {
  private readonly i18n = inject(I18nService);
  private readonly salons = inject(SalonsClient);
  private readonly dates = cardDates();
  private readonly card = loadedCard(SALON_CARD);
  protected readonly profile = this.card.profile;
  protected readonly scope = this.card.scope;
  protected readonly editing = signal(false);

  /**
   * «SMS-сповіщення клієнтам» set to the state the checkbox was turned to. The card becomes the
   * Салон the backend answers with; nothing changes on a refusal or a cancelled dialog.
   */
  protected readonly smsChange = reasonAction<boolean, Salon>({
    run: (reason, enabled) =>
      this.card.change(
        this.salons.setSmsNotifications(this.profile().salonId, { enabled, reason }),
        (_salon, answer) => answer,
      ),
    toast: (_answer, enabled) => smsCopyOf(enabled).done,
    reasonRequired: false,
  });

  /**
   * What the checkbox shows: the state its dialog is open on while it asks — the one the
   * administrator has just clicked to — and the Салон's own otherwise. Cancelling the dialog puts
   * the checkbox back, because it no longer asks.
   */
  protected readonly smsShown = computed(
    () => this.smsChange.asked() ?? this.profile().smsNotificationsEnabled,
  );

  /**
   * The words of the way the dialog asks — kept once it closes, so they do not flip to the other
   * direction as it fades out on the answer.
   */
  protected readonly smsCopy = signal(SMS_ENABLE_COPY);

  protected askSmsChange(enabled: boolean): void {
    this.smsCopy.set(smsCopyOf(enabled));
    this.smsChange.ask(enabled);
  }

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
