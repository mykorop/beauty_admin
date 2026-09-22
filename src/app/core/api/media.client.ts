import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
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
 * The content of a profile as the panel reads and moderates it.
 *
 * There is deliberately nothing here that **uploads**: the content of a profile stays its owner's
 * business, and the backend has no endpoint for it either. Every write below destroys, and none of
 * them can be undone — the Cloudinary file is gone, not unlinked.
 */
@Injectable({ providedIn: 'root' })
export class MediaClient {
  private readonly http = inject(HttpClient);

  salon(salonId: string): Observable<ProfileMedia> {
    return this.http.get<ProfileMedia>(adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/media`));
  }

  master(masterId: string): Observable<ProfileMedia> {
    return this.http.get<ProfileMedia>(adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/media`));
  }

  /**
   * One photo out of a gallery. The URL is the address — `imagesUrls` is an unkeyed array, so an
   * index would name a different picture the moment the owner reorders it. Answers with the whole
   * tab, so it redraws from the answer.
   */
  deleteSalonImage(salonId: string, imageUrl: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/images`), {
      body: { imageUrl, reason },
    });
  }

  deleteMasterImage(masterId: string, imageUrl: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/images`), {
      body: { imageUrl, reason },
    });
  }

  /** A Майстер only: a Салон has no avatar of its own. */
  deleteMasterAvatar(masterId: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/avatar`), {
      body: { reason },
    });
  }

  /** The certificate and its scan together. */
  deleteSalonCertificate(salonId: string, certificateId: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(
      adminApiUrl(`/admin/salons/${encodeURIComponent(salonId)}/certificates/${encodeURIComponent(certificateId)}`),
      { body: { reason } },
    );
  }

  deleteMasterCertificate(masterId: string, certificateId: string, reason: string): Observable<ProfileMedia> {
    return this.http.delete<ProfileMedia>(
      adminApiUrl(`/admin/masters/${encodeURIComponent(masterId)}/certificates/${encodeURIComponent(certificateId)}`),
      { body: { reason } },
    );
  }
}
