import type { Signal, Type } from '@angular/core';
import type { Routes } from '@angular/router';
import type { Observable } from 'rxjs';
import type { TranslationKey } from '../../i18n/translations';
import type { CardScope } from './card-scope';

/** A profile edited under the `updatedAt` it was read with — every kind of them has one. */
export type Versioned = { updatedAt: string | null };

/** What one opening of a card has read: the profile, and what it sits inside (`null` for nothing). */
export type Loaded<P, C> = { profile: P; context: C };

/** How a state tag is coloured — PrimeNG's own severities. */
export type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger';

/**
 * The card a profile sits inside, as the header names it: the Салон a Майстер салону works in —
 * a link, for it is a card of its own — or the one a Незалежний майстер has since left.
 */
export type CardContext =
  | { kind: 'salon'; salonId: string; name: string }
  | { kind: 'formerSalon'; name: string; leftAt: string | null };

/** Everything the card draws above its tabs, as one kind of profile describes itself. */
export type CardHeader = {
  title: string;
  /** What the dialogs call the profile. */
  subject: string;
  /** The state tag. */
  tag: { labelKey: TranslationKey; severity: TagSeverity };
  /** Nothing about it is a warning: the future Записи it still has are no concern of the banner. */
  active: boolean;
  /** A Власник-майстер: always on the Ростер, never removable from it. */
  owner: boolean;
  context: CardContext | null;
  /** Read-only for good: the profile is Видалений — or, for a Майстер салону, his Салон is. */
  deleted: { at: string | null } | null;
  blocked: { at: string | null; reason: string | null } | null;
};

/**
 * One kind of profile, as its card reads and describes it — all a new kind of card has to write.
 * A root service, and stateless: which profile is open, and what came back, is the card's own.
 *
 * Declared with methods, so that a kind's own adapter stands in for any other's.
 */
export interface CardAdapter<I, P extends Versioned, C> {
  /**
   * Reads what `ids` name: the profile and what it sits inside, together — both land, or the card
   * fails. A read may answer nothing and send the reader to where the profile really is.
   */
  read(ids: I): Observable<Loaded<P, C>>;
  /** Reads the profile alone again — what its owner saved meanwhile, after an edit conflict. */
  reload?(loaded: Loaded<P, C>): Observable<P>;
  header(loaded: Loaded<P, C>): CardHeader;
  scope(loaded: Loaded<P, C>): CardScope;
}

/** A tab of a card: its address under the card, its label, and the screen behind it. */
export type CardTab = {
  path: string;
  labelKey: TranslationKey;
  load: () => Promise<Type<unknown>>;
};

/**
 * One kind of profile card: its adapter, its tabs, the way back and the words that are its own. The
 * card itself — header, banners, Блокування, «не знайдено» — is the same for every kind.
 */
export type ProfileCardKind<I, P extends Versioned, C> = {
  adapter: Type<CardAdapter<I, P, C>>;
  /** In the order of the strip; the first is where the card opens. */
  tabs: readonly CardTab[];
  back: {
    /** Where the way back leads — the list, or the Ростер the profile was opened from. */
    link(loaded: Loaded<P, C>): string;
    labelKey: TranslationKey;
  };
  copy: {
    notFound: TranslationKey;
    /** The Видалений banner, with the moment it happened — and without it, for rows that lack one. */
    deletedBanner: TranslationKey;
    deletedBannerNoDate: TranslationKey;
    /** `null` for a kind that is never blocked. */
    blockedBanner: TranslationKey | null;
    /** How «Історія» says nothing happened yet, where the kind words it its own way. */
    historyEmpty?: TranslationKey;
  };
};

/** The routes of a card, built from its tabs: each under its own address. */
export function cardRoutes(tabs: readonly CardTab[]): Routes {
  return [
    { path: '', pathMatch: 'full', redirectTo: tabs[0].path },
    ...tabs.map(({ path, load }) => ({ path, loadComponent: load })),
    // A mistyped tab stays on the card instead of falling through to the app's wildcard.
    { path: '**', redirectTo: tabs[0].path },
  ];
}

/**
 * The profile a card has loaded, as its tabs are given it (`loadedCard`). There is no profile to
 * miss: a tab exists only inside a loaded card, and a new opening builds every tab anew.
 *
 * Nothing outside writes the profile. Every change of it is a request made here whose answer
 * becomes the card — header and every tab — before the sender hears of it. The requests are cold:
 * whoever sends one binds it to the opening that asked (the reason action and the concurrent edit
 * do), so an answer that lands after the card has moved on is dropped, whichever profile it is
 * about.
 */
export type LoadedCard<P, C> = {
  readonly profile: Signal<P>;
  /** What the profile sits inside: the Салон of a Майстер салону; `null` for every other kind. */
  readonly context: Signal<C>;
  readonly scope: Signal<CardScope>;
  /**
   * Saves an edit of the Профіль under the `updatedAt` the card shows: if the owner saved since,
   * the backend refuses with `EDIT_CONFLICT` instead of overwriting that save.
   */
  update(change: { patch: Partial<P>; reason?: string }): Observable<P>;
  /** Reads the profile again — what was saved meanwhile, after an edit conflict. */
  reload(): Observable<P>;
  /** Any other change of the profile: the answer to `request`, folded into it, becomes the card. */
  change<T>(request: Observable<T>, fold: (profile: P, answer: T) => P): Observable<T>;
};
