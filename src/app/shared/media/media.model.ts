import type { Observable } from 'rxjs';
import type { ProfileMedia } from '../../core/api/media.client';

/**
 * The reads and the destroys of one «Фото й сертифікати» tab, bound to whose content it is — the
 * same trick the Записи and Відгуки tabs use, so one screen serves the Салон and the Майстер.
 *
 * `deleteAvatar` is `null` for a Салон: it has no avatar of its own, and an always-refusing button
 * would be worse than no button.
 */
export type MediaPort = {
  /** The venue's clock: certificate dates are printed on it, not on the browser's. */
  timezone: string;
  /**
   * `false` for a Видалений профіль, whose content is readable and no longer anyone's to change —
   * the backend refuses every destroy over one with `409`, and a button that only ever earns an
   * error toast is worse than no button. The same gate the Години роботи and Каталог tabs use.
   */
  writable: boolean;
  load(): Observable<ProfileMedia>;
  deleteImage(imageUrl: string, reason: string): Observable<ProfileMedia>;
  deleteAvatar: ((reason: string) => Observable<ProfileMedia>) | null;
  deleteCertificate(certificateId: string, reason: string): Observable<ProfileMedia>;
};
