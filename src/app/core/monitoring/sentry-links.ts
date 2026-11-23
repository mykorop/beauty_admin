import { environment } from '../../../environments/environment';

/**
 * Where the panel leads into Sentry. Each link is a search of Sentry's issues, which its web app
 * runs for whoever is signed in there — no API token in the panel, no proxy in `admin-api`.
 */
export type SentryLinks = {
  /** The issues of one trace — the app's, the panel's and the backend's alike. */
  trace(traceId: string): string;
  /** One event: Sentry's issue search opens it when asked for its bare id. */
  event(eventId: string): string;
  /** Every error of one account, by its Cognito `sub` — the `user.id` all BookMe projects set. */
  errorsOf(userId: string): string;
};

/**
 * The links into the Sentry organisation at `orgUrl` — `https://<org>.sentry.io`, or
 * `https://sentry.io/organizations/<org>` — or `null` for an empty address: no links at all.
 *
 * A search spans every project (`project=-1`), since a trace runs from an app into the backend,
 * and the 90 days the Журнал активності keeps its entries, where Sentry would show 14.
 */
export function sentryLinks(orgUrl: string): SentryLinks | null {
  const base = orgUrl.replace(/\/+$/, '');
  if (!base) {
    return null;
  }
  const issues = (query: string): string =>
    `${base}/issues/?${new URLSearchParams({ project: '-1', statsPeriod: '90d', query })}`;
  return {
    trace: (traceId) => issues(`trace:${traceId}`),
    event: (eventId) => issues(eventId),
    errorsOf: (userId) => issues(`user.id:${userId}`),
  };
}

/** The links of this build; `null` while its environment names no Sentry organisation. */
export const SENTRY_LINKS = sentryLinks(environment.sentry.orgUrl);
