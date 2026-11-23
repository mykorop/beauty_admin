import { inject, type WritableSignal } from '@angular/core';
import {
  ActivityClient,
  type ActivityEntry,
  type ActivityLogQuery,
} from '../../core/api/activity.client';
import { type Feed, feed } from '../feed';

/**
 * The Журнал активності as the «Журнал активності» screen and a card's «Активність» both read it:
 * a page at a time, newest first, with the rows opened into their details kept per list — a new
 * list, under another question or after «Оновити», opens with every row closed.
 */
export type ActivityFeed = Feed<ActivityEntry> & {
  /** The rows opened into their details, by `activityId`. */
  readonly expanded: WritableSignal<ReadonlySet<string>>;
};

/**
 * The feed of `query`, asked anew whenever it changes; `null` asks nothing yet. Made in the
 * injection context of the screen that shows it, and ends with that screen.
 */
export function activityFeed(query: () => ActivityLogQuery | null): ActivityFeed {
  const client = inject(ActivityClient);
  const log = feed({ query, read: (asked, cursor) => client.list(asked, cursor) });
  return { ...log, expanded: log.listState<ReadonlySet<string>>(new Set()) };
}
