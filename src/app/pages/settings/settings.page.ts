import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Checkbox } from 'primeng/checkbox';
import { catchError, EMPTY } from 'rxjs';
import { type PlatformSettings, PlatformSettingsClient } from '../../core/api/settings.client';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { reasonAction } from '../../shared/reason-dialog/reason-action';
import { ReasonDialog } from '../../shared/reason-dialog/reason-dialog';

/**
 * The words of one direction of «Українські номери (+380)», spelled out rather than assembled from
 * a prefix, so a mistyped key fails the compiler, not the screen.
 */
type UkrainianPhonesCopy = {
  title: TranslationKey;
  message: TranslationKey;
  confirm: TranslationKey;
  done: TranslationKey;
  /** Turning it off takes codes and SMS away from Ukrainian numbers; turning it on does not. */
  severity: 'primary' | 'danger';
};

const UKRAINIAN_PHONES_ENABLE_COPY: UkrainianPhonesCopy = {
  title: 'settings.ukrainianPhones.enable.title',
  message: 'settings.ukrainianPhones.enable.message',
  confirm: 'settings.ukrainianPhones.enable.confirm',
  done: 'settings.ukrainianPhones.enable.done',
  severity: 'primary',
};

const UKRAINIAN_PHONES_DISABLE_COPY: UkrainianPhonesCopy = {
  title: 'settings.ukrainianPhones.disable.title',
  message: 'settings.ukrainianPhones.disable.message',
  confirm: 'settings.ukrainianPhones.disable.confirm',
  done: 'settings.ukrainianPhones.disable.done',
  severity: 'danger',
};

const ukrainianPhonesCopyOf = (enabled: boolean): UkrainianPhonesCopy =>
  enabled ? UKRAINIAN_PHONES_ENABLE_COPY : UKRAINIAN_PHONES_DISABLE_COPY;

/**
 * «Налаштування»: the settings of the platform itself, today one — «Українські номери (+380)».
 *
 * It is the platform's decision, it costs money (an SMS to Ukraine costs about fourteen times one
 * to Moldova) and it is written to the Журнал дій, so it is taken through the «дія з причиною»
 * dialog — with a reason the administrator may leave out — as a Салон's «SMS-сповіщення клієнтам»
 * is. The page shows the settings the backend answers with, never what the click hoped.
 */
@Component({
  selector: 'app-settings-page',
  imports: [Checkbox, FormsModule, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  private readonly client = inject(PlatformSettingsClient);

  protected readonly settings = signal<PlatformSettings | null>(null);
  protected readonly failed = signal(false);

  /**
   * «Українські номери (+380)» set to the state the checkbox was turned to. The page becomes the
   * settings the backend answers with; nothing changes on a refusal or a cancelled dialog.
   */
  protected readonly ukrainianPhonesChange = reasonAction<boolean, PlatformSettings>({
    run: (reason, enabled) => this.client.setUkrainianPhones({ enabled, reason }),
    accept: (settings) => this.settings.set(settings),
    toast: (_settings, enabled) => ukrainianPhonesCopyOf(enabled).done,
    reasonRequired: false,
  });

  /**
   * What the checkbox shows: the state its dialog is open on while it asks — the one the
   * administrator has just clicked to — and the platform's own otherwise. Cancelling the dialog
   * puts the checkbox back, because it no longer asks.
   */
  protected readonly ukrainianPhonesShown = computed(
    () => this.ukrainianPhonesChange.asked() ?? this.settings()?.ukrainianPhonesEnabled,
  );

  /**
   * The words of the way the dialog asks — kept once it closes, so they do not flip to the other
   * direction as it fades out on the answer.
   */
  protected readonly ukrainianPhonesCopy = signal(UKRAINIAN_PHONES_ENABLE_COPY);

  constructor() {
    this.client
      .get()
      // The interceptor has already worded the refusal as a toast; the page says it has nothing.
      .pipe(
        catchError(() => (this.failed.set(true), EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((settings) => this.settings.set(settings));
  }

  protected askUkrainianPhonesChange(enabled: boolean): void {
    this.ukrainianPhonesCopy.set(ukrainianPhonesCopyOf(enabled));
    this.ukrainianPhonesChange.ask(enabled);
  }
}
