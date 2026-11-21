import type { ActivityLogQuery } from '../../core/api/activity.client';

/**
 * Whose entries of the Журнал активності a card's «Активність» shows: what one account did, or all
 * that happened in one Місце. `kind` is the name the «Журнал активності» screen's address gives
 * that filter, so the screen opened from the tab shows the same entries, to be narrowed further.
 */
export type ActivitySubject = { kind: 'account' | 'place'; id: string };

/**
 * What the backend is asked: the account by its id, or the Місце. No period — the entries of one
 * account or one Місце are read whole, all the log keeps.
 */
export function activitySubjectQuery({ kind, id }: ActivitySubject): ActivityLogQuery {
  return kind === 'account' ? { actorId: id } : { placeId: id };
}

/** Where the «Журнал активності» screen opens on the same entries — «Відкрити в Журналі активності». */
export function activityLogLink({ kind, id }: ActivitySubject): {
  path: string[];
  queryParams: Record<string, string>;
} {
  return { path: ['/activity-log'], queryParams: { [kind]: id } };
}
