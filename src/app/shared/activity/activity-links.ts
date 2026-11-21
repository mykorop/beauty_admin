import type { ActivityActor, ActivityPlace } from '../../core/api/activity.client';
import { profileCardLink } from '../profile-card-link';

/**
 * Where the card of whoever an entry names lives. Shared, like `ActivityEntryDetails`, so the
 * «Активність» tab of a card links an entry as the screen does.
 */

/** By role. An Адміністратор has no card of his own, nor does the Адміністратор платформи. */
const ACTOR_CARD: Partial<Record<string, (id: string) => string[]>> = {
  client: (id) => ['/clients', id],
  // A Власник is shown by his Основний салон, whose id is his.
  salon: (id) => profileCardLink('salon', id),
  // The card of a Незалежний майстер sends a Майстер салону on to his card inside the Салон.
  master: (id) => profileCardLink('independentMaster', id),
};

export const actorCardLink = (actor: ActivityActor): string[] | null =>
  ACTOR_CARD[actor.role]?.(actor.id) ?? null;

/** A Салон's card, or a Майстер's — the one a Незалежний майстер is his own Місце in. */
export const placeCardLink = (place: ActivityPlace): string[] =>
  profileCardLink(place.type === 'salon' ? 'salon' : 'independentMaster', place.id);
