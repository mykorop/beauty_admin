import { computed, effect, type Signal, untracked, type WritableSignal } from '@angular/core';
import type { Observable } from 'rxjs';
import { listLevel } from './profile-card/card-lifetime';
import type { RequestScope } from './request-scope';

/** One page of a feed, as every paged read of `admin-api` answers it. */
export type FeedPage<T> = { items: T[]; nextCursor: string | null };

/** The list a feed shows its pages in. */
export type FeedList<T> = {
  readonly rows: Signal<T[] | null>;
  /** A new list — `null` while its first page is read. */
  show(rows: T[] | null): void;
  /** The list shown, read one page further. */
  append(rows: T[]): void;
};

export type FeedSource<Q, T> = {
  /**
   * What is asked — whose rows, under which filters — read reactively. Every new question shows a
   * new list from its first page; `null` asks nothing yet. The question is asked anew whenever a
   * signal it reads changes, so one that reads more than it asks — a whole profile for its id — is
   * best a `computed` with its own `equal`.
   */
  query: () => Q | null;
  /** Reads the page of `query` after `cursor`, or its first page. */
  read: (query: Q, cursor?: string) => Observable<FeedPage<T>>;
  /**
   * Where the pages are shown, when the rows are another's to keep — the Записи whose open one and
   * whose actions `AppointmentInteraction` binds. The feed keeps its own list otherwise.
   */
  list?: FeedList<T>;
};

/** A feed as its screen draws it. */
export type Feed<T> = {
  /** The rows read so far; `null` until the first page lands, and after it was refused. */
  readonly items: Signal<T[] | null>;
  /** Another page lies beyond the last one read — «Ще» is offered. */
  readonly hasMore: Signal<boolean>;
  /** A page is on its way; «Ще» is busy. */
  readonly loading: Signal<boolean>;
  /** The first page was refused, so there is no list to show. */
  readonly failed: Signal<boolean>;
  /** «Ще»: the next page — unless one is already on its way, or none is left. */
  loadMore(): void;
  /** The same question asked anew — «Оновити»: a new list from its first page. */
  reload(): void;
  /** State that is one list's own — `initial` again whenever the feed shows a new list. */
  listState<S>(initial: S): WritableSignal<S>;
  /**
   * The level of the list shown. What else is one list's own and asks the backend — an action over
   * its rows — is bound here, so a new list drops its answer along with the list's own pages.
   */
  readonly scope: RequestScope;
};

/**
 * A list read a page at a time by cursor, with «Ще» for the next page: «Історія» of a card,
 * «Інвайти» of a Салон, the Журнал дій, Відгуки and Записи of a Клієнт read their rows this way.
 *
 * What is read stays read. A refused page is a toast (the interceptor words it) and «Ще» asks
 * again; only a refused first page leaves nothing to show. A press while a page is on its way asks
 * for nothing more, so a series of presses is one request. A new question starts the list over,
 * and a page asked under the old one is dropped wherever it lands — as is everything asked while
 * the card around the list had another opening (`CardLifetime`).
 *
 * Made in the injection context of the screen that shows it, and ends with that screen.
 */
export function feed<Q, T>(source: FeedSource<Q, T>): Feed<T> {
  const level = listLevel();
  const list = source.list ?? ownList<T>(level);
  const asked = computed(source.query);
  const cursor = level.state<string | null>(null);
  const loading = level.state(false);
  const failed = level.state(false);

  const read = (query: Q, after?: string): void => {
    loading.set(true);
    level.run(source.read(query, after), {
      next: ({ items, nextCursor }) => {
        list.append(items);
        cursor.set(nextCursor);
      },
      // The interceptor has already worded the refusal as a toast; what was read stays.
      error: () => failed.set(list.rows() === null),
      done: () => loading.set(false),
    });
  };

  const start = (query: Q | null): void => {
    level.renew();
    list.show(null);
    if (query !== null) {
      read(query);
    }
  };

  effect(() => {
    const query = asked();
    untracked(() => start(query));
  });

  return {
    items: list.rows,
    hasMore: computed(() => cursor() !== null),
    loading: loading.asReadonly(),
    failed: failed.asReadonly(),
    loadMore: () => {
      const query = asked();
      const after = cursor();
      if (loading() || query === null || after === null) {
        return;
      }
      read(query, after);
    },
    reload: () => start(asked()),
    listState: (initial) => level.state(initial),
    scope: level,
  };
}

/** Rows that belong to the list shown, like everything else of it. */
function ownList<T>(level: RequestScope): FeedList<T> {
  const rows = level.state<T[] | null>(null);
  return {
    rows: rows.asReadonly(),
    show: (shown) => rows.set(shown),
    append: (page) => rows.update((shown) => [...(shown ?? []), ...page]),
  };
}
