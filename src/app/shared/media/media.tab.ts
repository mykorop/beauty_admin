import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { catchError, EMPTY, type Observable } from 'rxjs';
import { type Certificate, MediaClient, type ProfileMedia } from '../../core/api/media.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { reasonAction } from '../reason-dialog/reason-action';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import { cardScope } from '../profile-card/loaded-card';
import { formatVenueDate } from '../venue-date';

/** What a confirmation is about, and how it words itself. */
type MediaAsk = {
  titleKey: TranslationKey;
  messageKey: TranslationKey;
  /** What the sentence names: a certificate's title, or the file itself. */
  name: string;
  destroy: (reason: string) => Observable<ProfileMedia>;
};

/**
 * «Фото й сертифікати» of a Салон or of a Незалежний майстер: the gallery, the avatar and the
 * certificates with the files behind them.
 *
 * Every action here is **irreversible** — the file is destroyed in Cloudinary, not unlinked — and
 * the tab says so before anything is clicked, not only inside the confirmation. There is no way to
 * add anything: uploading in the owner's place is deliberately impossible, and the backend has no
 * endpoint for it either.
 *
 * Whose content it is is the card's scope. A Видалений профіль is read-only here, as it is on every
 * other tab of its card: its content is readable and no longer anyone's to change, and a button
 * that only ever earns an error toast is worse than no button. The answer to every destroy is the
 * whole tab, so it redraws from what the backend says rather than from what the click hoped.
 */
@Component({
  selector: 'app-media',
  imports: [ButtonDirective, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'moderation-page' },
  templateUrl: './media.tab.html',
})
export class MediaTab {
  private readonly client = inject(MediaClient);
  private readonly i18n = inject(I18nService);
  private readonly scope = cardScope();

  protected readonly writable = computed(() => this.scope().writable);
  /** Only a profile with an avatar of its own has one to destroy: an always-refusing button is worse. */
  protected readonly avatarWritable = computed(
    () => this.writable() && this.scope().capabilities.avatar,
  );

  protected readonly media = signal<ProfileMedia | null>(null);
  protected readonly failed = signal(false);
  protected readonly unavailableImages = signal<ReadonlySet<string>>(new Set());

  /**
   * Видалення вмісту: the file the dialog is open on is destroyed, and the tab redraws from the
   * answer. A refusal — an owner who reordered the gallery in between, a Видалений profile — leaves
   * the dialog open with the reason as typed.
   */
  protected readonly removal = reasonAction({
    run: (reason, ask: MediaAsk) => ask.destroy(reason),
    accept: (media) => this.media.set(media),
  });

  protected readonly certificates = computed(() => {
    const locale = this.i18n.locale();
    const timezone = this.scope().timezone;
    return (
      this.media()?.certificates.map((certificate) => ({
        certificate,
        dates: this.i18n.t(
          certificate.expiresAt ? 'media.certificate.period' : 'media.certificate.issued',
          {
            issued: formatVenueDate(certificate.issuedAt, locale, timezone),
            expires: formatVenueDate(certificate.expiresAt, locale, timezone),
          },
        ),
      })) ?? null
    );
  });

  constructor() {
    this.client
      .read(this.scope())
      // The interceptor has already worded the refusal as a toast; the tab says it has nothing.
      .pipe(
        catchError(() => (this.failed.set(true), EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe((media) => this.media.set(media));
  }

  protected imageUnavailable(url: string): void {
    this.unavailableImages.update((urls) => new Set([...urls, url]));
  }

  protected askPhoto(imageUrl: string): void {
    this.removal.ask({
      titleKey: 'media.photo.title',
      messageKey: 'media.photo.message',
      name: imageUrl,
      destroy: (reason) => this.client.deleteImage(this.scope(), imageUrl, reason),
    });
  }

  protected askAvatar(avatarUrl: string): void {
    this.removal.ask({
      titleKey: 'media.avatar.title',
      messageKey: 'media.avatar.message',
      name: avatarUrl,
      destroy: (reason) => this.client.deleteAvatar(this.scope(), reason),
    });
  }

  protected askCertificate(certificate: Certificate): void {
    this.removal.ask({
      titleKey: 'media.certificate.title',
      messageKey: 'media.certificate.message',
      name: certificate.title || certificate.certificateId,
      destroy: (reason) =>
        this.client.deleteCertificate(this.scope(), certificate.certificateId, reason),
    });
  }
}
