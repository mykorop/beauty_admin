import type { ActivityLogQuery } from '../../core/api/activity.client';
import type { SentryLinks } from '../../core/monitoring/sentry-links';
import type { TranslationKey } from '../../i18n/translations';

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

/**
 * «Помилки в Sentry» of a card's «Активність»: the errors of the account the card is of, by the
 * `user.id` every BookMe project sets — a Майстер's, a Клієнт's own; a Салон, being no account, has
 * its Власник's, worded as his. `null` for a Салон whose Власник `admin-api` does not name, and
 * without `links` — a build that names no Sentry organisation.
 */
export function sentryErrorsLink(
  { subjects, owner }: { subjects: readonly ActivitySubject[]; owner: string | null },
  links: SentryLinks | null,
): { href: string; labelKey: TranslationKey } | null {
  const account = owner ?? subjects.find((subject) => subject.kind === 'account')?.id ?? null;
  if (!links || account === null) {
    return null;
  }
  return {
    href: links.errorsOf(account),
    labelKey: owner === null ? 'activityTab.sentryErrors' : 'activityTab.ownerSentryErrors',
  };
}
