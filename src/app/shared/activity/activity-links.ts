import type { ActivityActor, ActivityEntry, ActivityPlace } from '../../core/api/activity.client';
import { profileCardLink } from '../profile-card-link';

/**
 * Where the card of whoever an entry names lives. Shared, like `ActivityEntryDetails`, so the
 * «Активність» tab of a card links an entry as the screen does.
 */

const clientCardLink = (id: string): string[] => ['/clients', id];

/** By role. An Адміністратор has no card of his own, nor does the Адміністратор платформи. */
const ACTOR_CARD: Partial<Record<string, (id: string) => string[]>> = {
  client: clientCardLink,
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

/** What an id of a request's address names, where the panel words it. */
export type PathIdKind = 'appointment' | 'service' | 'master' | 'salon' | 'client';

/**
 * One id of a request's address: the parameter it stood in, what it names (`null` — something the
 * panel does not word, shown by its parameter), and the screen of the panel that shows it — `null`
 * where there is none.
 */
export type PathId = { param: string; kind: PathIdKind | null; id: string; link: string[] | null };

/** The Місце an entry names by its ids — what a service's link needs to find its Каталог. */
type EntryPlaceIds = Pick<ActivityEntry, 'salonId' | 'masterId'>;

/** The path parameters the panel knows, by name: what each names, and where its screen is. */
const KNOWN_PATH_PARAMS = new Map<
  string,
  { kind: PathIdKind; link: (id: string, place: EntryPlaceIds) => string[] | null }
>([
  // A Запис is opened inside a list of Записи, and the Записи of its Місце show a window of days
  // that need not hold it: the panel has no screen of one Запис to lead to.
  ['appointmentId', { kind: 'appointment', link: () => null }],
  // A service lives in the Каталог послуг of its Місце — of a Майстер салону, among his Копії.
  ['serviceId', { kind: 'service', link: (_id, place) => serviceCatalogLink(place) }],
  ['masterId', { kind: 'master', link: (id) => profileCardLink('independentMaster', id) }],
  ['salonId', { kind: 'salon', link: (id) => profileCardLink('salon', id) }],
  ['clientId', { kind: 'client', link: clientCardLink }],
]);

/** The Каталог послуг of the Місце an entry happened in; `null` without one. */
function serviceCatalogLink({ salonId, masterId }: EntryPlaceIds): string[] | null {
  if (salonId) {
    return masterId
      ? ['/salons', salonId, 'masters', masterId, 'services']
      : ['/salons', salonId, 'services'];
  }
  return masterId ? ['/independent-masters', masterId, 'services'] : null;
}

/**
 * The ids of an entry's request address, in the order the entry keeps them: each the panel knows
 * worded and, where the panel has a screen for it, leading there; any other kept as it came.
 */
export function pathIdsOf(
  entry: Pick<ActivityEntry, 'pathParams' | 'salonId' | 'masterId'>,
): PathId[] {
  return Object.entries(entry.pathParams).map(([param, id]) => {
    const known = KNOWN_PATH_PARAMS.get(param);
    return { param, kind: known?.kind ?? null, id, link: known?.link(id, entry) ?? null };
  });
}
