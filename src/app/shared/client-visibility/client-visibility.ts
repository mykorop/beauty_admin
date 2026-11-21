import type {
  ClientVisibility,
  ProfileClientVisibility,
  SalonClientVisibility,
} from '../../core/api/client-visibility.model';
import type { Master } from '../../core/api/masters.client';
import type { SalonMaster } from '../../core/api/salon-masters.client';

/**
 * What a card shows of a profile's Видимість — read only: it is the business's own choice, and the
 * panel has no way to change it.
 */
export type ClientVisibilityView = {
  /** Whose choice it is: the profile's own, or that of the Салон a Майстер салону lives by. */
  decidedBy: 'own' | 'salon';
  /** `null` where the answer does not say: a dash, never a guessed Публічний. */
  visibility: ClientVisibility | null;
  pricesHidden: boolean | null;
  /** Who last changed either, and when; `null` where nobody ever chose them. */
  lastChange: { at: string | null; by: string | null } | null;
};

/** A Салон's or a Незалежний майстер's own Видимість, as its card has it. */
export function ownClientVisibility(profile: ProfileClientVisibility): ClientVisibilityView {
  const at = profile.clientVisibilityUpdatedAt ?? null;
  const by = profile.clientVisibilityUpdatedBy?.actorName || null;
  return {
    decidedBy: 'own',
    visibility: profile.clientVisibility ?? null,
    pricesHidden: profile.pricesHidden ?? null,
    lastChange: at || by ? { at, by } : null,
  };
}

/**
 * The Видимість a Майстер салону lives by: his Салон's. Who chose it is the Салон card's to say —
 * `salon` on a master's card does not carry it.
 */
function visibilityDecidedBySalon(salon: SalonClientVisibility): ClientVisibilityView {
  return {
    decidedBy: 'salon',
    visibility: salon.clientVisibility ?? null,
    pricesHidden: salon.pricesHidden ?? null,
    lastChange: null,
  };
}

/**
 * A Майстер's Видимість, as his card (`GET /admin/masters/{masterId}`) has it. While he is on a
 * Ростер it is his Салон's: the fields at the top of the card are the ones he set as a Незалежний
 * майстер, kept for the day he leaves, and they are not what clients get of him now.
 *
 * The panel opens such a master inside his Салон (`MasterCardAdapter` sends him there before his
 * Профіль draws), so the Незалежний майстер card shows his own in practice. The choice is still
 * made here rather than left to that redirect: his own must never be shown as the one in force.
 */
export function masterClientVisibility(
  master: ProfileClientVisibility & Pick<Master, 'salon'>,
): ClientVisibilityView {
  return master.salon?.current
    ? visibilityDecidedBySalon(master.salon)
    : ownClientVisibility(master);
}

/**
 * A Майстер салону's Видимість on his card inside the Салон: the Салон's, read from the Салон's own
 * card, while he is on its Ростер. `null` once the collaboration has ended — the Салон's is no
 * longer what clients get of him, and his own is on his card as a Незалежний майстер.
 */
export function salonMasterClientVisibility(
  rosterLink: Pick<SalonMaster, 'status'>,
  salon: SalonClientVisibility,
): ClientVisibilityView | null {
  return rosterLink.status === 'ACTIVE' ? visibilityDecidedBySalon(salon) : null;
}
