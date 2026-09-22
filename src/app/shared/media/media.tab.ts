import { ChangeDetectionStrategy, Component, computed, inject, input, type OnInit, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { catchError, EMPTY, type Observable } from 'rxjs';
import type { Certificate, ProfileMedia } from '../../core/api/media.client';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';
import { ReasonDialog } from '../reason-dialog/reason-dialog';
import { formatVenueDate } from '../venue-date';
import type { MediaPort } from './media.model';

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
 * Whose content it is lives entirely in the `port`; the answer to every destroy is the whole tab,
 * so it redraws from what the backend says rather than from what the click hoped.
 */
@Component({
  selector: 'app-media',
  imports: [ButtonDirective, ReasonDialog, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media.tab.html',
})
export class MediaTab implements OnInit {
  /** Whose content this is — both the read and the three destroys go through it. */
  readonly port = input.required<MediaPort>();

  private readonly i18n = inject(I18nService);

  /** A Видалений профіль is read-only here, as it is on every other tab of its card. */
  protected readonly writable = computed(() => this.port().writable);

  protected readonly media = signal<ProfileMedia | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly asked = signal<MediaAsk | null>(null);

  protected readonly certificates = computed(() => {
    const locale = this.i18n.locale();
    const timezone = this.port().timezone;
    return (
      this.media()?.certificates.map((certificate) => ({
        certificate,
        dates: this.i18n.t(certificate.expiresAt ? 'media.certificate.period' : 'media.certificate.issued', {
          issued: formatVenueDate(certificate.issuedAt, locale, timezone),
          expires: formatVenueDate(certificate.expiresAt, locale, timezone),
        }),
      })) ?? null
    );
  });

  // `port` is an input, so the first read waits for the bindings — not the constructor.
  ngOnInit(): void {
    this.read();
  }

  protected askPhoto(imageUrl: string): void {
    this.asked.set({
      titleKey: 'media.photo.title',
      messageKey: 'media.photo.message',
      name: imageUrl,
      destroy: (reason) => this.port().deleteImage(imageUrl, reason),
    });
  }

  protected askAvatar(avatarUrl: string): void {
    const deleteAvatar = this.port().deleteAvatar;
    if (!deleteAvatar) {
      return;
    }
    this.asked.set({
      titleKey: 'media.avatar.title',
      messageKey: 'media.avatar.message',
      name: avatarUrl,
      destroy: deleteAvatar,
    });
  }

  protected askCertificate(certificate: Certificate): void {
    this.asked.set({
      titleKey: 'media.certificate.title',
      messageKey: 'media.certificate.message',
      name: certificate.title || certificate.certificateId,
      destroy: (reason) => this.port().deleteCertificate(certificate.certificateId, reason),
    });
  }

  protected closeUnless(visible: boolean): void {
    if (!visible) {
      this.asked.set(null);
    }
  }

  /**
   * One flight at a time, and the dialog closes only once the backend has agreed: a refusal — an
   * owner who reordered the gallery in between, a Видалений profile — leaves it open with the
   * reason as typed, and the interceptor has already worded the code as a toast.
   */
  protected apply(ask: MediaAsk, reason: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    ask.destroy(reason).subscribe({
      next: (media) => {
        this.busy.set(false);
        this.asked.set(null);
        this.media.set(media);
      },
      error: () => this.busy.set(false),
    });
  }

  private read(): void {
    this.port()
      .load()
      // The interceptor has already worded the refusal as a toast; the tab says it has nothing.
      .pipe(catchError(() => (this.failed.set(true), EMPTY)))
      .subscribe((media) => this.media.set(media));
  }
}
