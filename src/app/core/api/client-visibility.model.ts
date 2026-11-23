/**
 * Видимість of a profile — the business's own choice of what clients get of it: Публічний (in
 * search), За посиланням (out of search, reachable by its own link) or Прихований (out of clients'
 * sight). Not Блокування and not deletion: it never changes a profile's `status`.
 */
export type ClientVisibility = 'public' | 'link' | 'hidden';

/** Who last changed a profile's Видимість or Приховані ціни: the name as it was then. */
export type ClientVisibilityAuthor = {
  actorId: string;
  actorRole: 'client' | 'salon' | 'salon_admin' | 'master' | 'admin';
  actorName: string;
};

/**
 * A Салон's or a Незалежний майстер's Видимість as its card carries it — read only: the panel has
 * no way to change it, and `PATCH` of the profile refuses these fields.
 *
 * All optional, for an `admin-api` from before Видимість sends none of them; the card then shows a
 * dash, never a guessed Публічний. The time and the author are `null` where nobody ever chose it.
 */
export type ProfileClientVisibility = {
  clientVisibility?: ClientVisibility;
  /** Приховані ціни: clients see the services, but «Ціну уточнюйте» in place of every price. */
  pricesHidden?: boolean;
  clientVisibilityUpdatedAt?: string | null;
  clientVisibilityUpdatedBy?: ClientVisibilityAuthor | null;
};

/**
 * A Салон's Видимість and Приховані ціни as a Майстер's card carries them beside the Салон's state:
 * what clients get of a Майстер салону. `null` when the Салон's row is gone entirely; absent from an
 * `admin-api` from before Видимість.
 */
export type SalonClientVisibility = {
  clientVisibility?: ClientVisibility | null;
  pricesHidden?: boolean | null;
};
