import type { AdminPath } from '../../core/api/admin-api-url';
import type { AuditTargetType } from '../../core/api/audit.client';
import type { ReviewsScope } from '../../core/api/reviews.client';

/** The four cards a profile can be open on. */
export type ProfileKind = 'salon' | 'master' | 'salonMaster' | 'client';

/**
 * What one kind of profile has that the others have not. Each is a real exception of the domain,
 * named here once, so that no tab asks which kind it is on.
 */
export type CardCapabilities = {
  /**
   * An avatar of its own to moderate — a Незалежний майстер's. A Салон's picture is the first photo
   * of its gallery, and a Майстер салону's avatar lives on his link to the Ростер.
   */
  avatar: boolean;
  /**
   * The Салон whose Ростер stands under the profile — a Салон's own: its Каталог has Копії майстрів,
   * and its Записи a Майстер to be narrowed by. `null` for every other kind.
   */
  roster: { salonId: string } | null;
  /**
   * The Салон whose Години роботи the Робочий графік stays inside — a Майстер салону's (`domain.md`
   * §1d). `null` where nothing bounds the week, and where there is no Робочий графік at all.
   */
  scheduleBounds: { salonId: string } | null;
  /**
   * Where the Профіль is edited under `updatedAt`: a Салон's on a path of its own (`…/profile`),
   * a Незалежний майстер's and a Майстер салону's at their root. `null` where nothing is edited — a
   * Клієнт's personal data is not the platform's to change.
   */
  profileEdit: AdminPath | null;
  /**
   * The Записи are the Салон's, narrowed to him — a Майстер салону's. It is the Салон that answers
   * for them, on its clock; `null` for a profile whose Записи are read at its own path.
   */
  appointmentsThroughSalon: { salonId: string; masterId: string } | null;
  /** Блокування, and its lifting, are offered on the card — for a profile that is its own listing. */
  block: boolean;
  /** «N майбутніх Записів» and the масове скасування of them — for a profile that takes bookings. */
  bulkCancel: boolean;
};

/**
 * Everything a tab knows about the profile its card is open on, in one value — the panel's twin of
 * the backend's Місце. The card works it out once from the profile it has read, and hands it to
 * every tab (`cardScope`); the clients of what lives under a profile — its Каталог послуг, Вміст
 * профілю, Робочий графік, future Записи and Блокування — take it instead of a pair of methods per
 * kind.
 */
export type CardScope = {
  kind: ProfileKind;
  /** The profile's own path in `admin-api`: every sub-resource of it lives beneath. */
  base: AdminPath;
  /**
   * The clock every moment of the card is printed on — the venue's, never the browser's. A Клієнт
   * belongs to no venue: his is the platform's.
   */
  timezone: string;
  /**
   * Anything may be changed here: the profile is not Видалений — nor, for a Майстер салону, is his
   * Салон. The backend refuses every write there as well, and a button that only ever earns an
   * error toast is worse than no button.
   */
  writable: boolean;
  capabilities: CardCapabilities;
  /** Whose rows «Історія» reads from the Журнал дій. */
  audit: { type: AuditTargetType; id: string };
  /**
   * Whose Відгуки the «Відгуки» tab reads: the ones left about a Салон, a Майстер, or a Майстер
   * inside one Салон — or, for a Клієнт, the ones he wrote, at his own address.
   */
  reviews: { about: ReviewsScope } | { writtenBy: string };
};
