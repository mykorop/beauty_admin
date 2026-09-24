import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CardScope } from '../../shared/profile-card/card-scope';
import { adminApiUrl } from './admin-api-url';

/** One certificate of a profile, with the file behind it — which is what the tab is read for. */
export type Certificate = {
  certificateId: string;
  title: string;
  issuer: string;
  issuedAt: string;
  /** `null` means «не спливає» — a stored value, not an absence. */
  expiresAt: string | null;
  credentialId: string | null;
  verificationUrl: string | null;
  notes: string | null;
  /** `''` for a certificate whose owner has not attached a scan. */
  fileUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Everything the «Фото й сертифікати» tab shows.
 *
 * `avatarUrl` is `null` for a Салон, which has no avatar of its own — its picture is the first
 * photo of its gallery, and there is nothing separate to moderate.
 */
export type ProfileMedia = {
  avatarUrl: string | null;
  images: string[];
  certificates: Certificate[];
};

/**
 * The content of a profile as the panel reads and moderates it — a Салон's or a Незалежний
 * майстер's, at the profile's own path.
 *
 * There is deliberately nothing here that **uploads**: the content of a profile stays its owner's
 * business, and the backend has no endpoint for it either. Every write below destroys, and none of
 * them can be undone — the Cloudinary file is gone, not unlinked. Each answers with the whole tab,
 * so it redraws from the answer.
 */
@Injectable({ providedIn: 'root' })
export class MediaClient {
  private readonly http = inject(HttpClient);

  read(scope: CardScope): Observable<ProfileMedia> {
    return this.http.get<ProfileMedia>(adminApiUrl(`${scope.base}/media`));
  }

  /**
   * One photo out of a gallery. The URL is the address — `imagesUrls` is an unkeyed array, so an
   * index would name a different picture the moment the owner reorders it.
   */
  deleteImage(scope: CardScope, imageUrl: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(adminApiUrl(`${scope.base}/images`), {
      body: { imageUrl, reason },
    });
  }

  /** Only where the profile has an avatar of its own (`CardCapabilities.avatar`). */
  deleteAvatar(scope: CardScope, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(adminApiUrl(`${scope.base}/avatar`), {
      body: { reason },
    });
  }

  /** The certificate and its scan together. */
  deleteCertificate(
    scope: CardScope,
    certificateId: string,
    reason: string,
  ): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(
      adminApiUrl(`${scope.base}/certificates/${encodeURIComponent(certificateId)}`),
      { body: { reason } },
    );
  }
}
