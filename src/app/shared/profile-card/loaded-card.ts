import { inject, InjectionToken, type Signal } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';
import { formatVenueDate, formatVenueDateTime } from '../venue-date';
import type { CardScope } from './card-scope';
import type { LoadedCard, ProfileCardKind, Versioned } from './profile-card.model';

/** A loaded card, with the kind it is a card of — so that a tab can ask for its own kind's profile. */
export type LoadedCardOfKind = LoadedCard<Versioned, unknown> & {
  readonly kind: ProfileCardKind<unknown, Versioned, unknown>;
};

/**
 * The card whose profile has loaded. Provided only inside the branch of the card that shows a
 * loaded profile (`LoadedProfileCard`) — so a tab, which renders there and nowhere else, always
 * finds one, and never finds it empty.
 */
export const LOADED_CARD = new InjectionToken<LoadedCardOfKind>('LOADED_CARD');

/**
 * The profile a card of `kind` has loaded, for a tab of that card. Made in the tab's injection
 * context. Asked by a tab routed into another kind's card, it fails at once, loudly: that is a
 * mistake in a tab table, not a state to show.
 */
export function loadedCard<I, P extends Versioned, C>(
  kind: ProfileCardKind<I, P, C>,
): LoadedCard<P, C> {
  const card = inject(LOADED_CARD);
  if ((card.kind as unknown) !== kind) {
    throw new Error('A tab asked for the profile of a card it is not a tab of.');
  }
  // The kind is the one asked for, so the profile it has loaded is the one it reads.
  return card as unknown as LoadedCard<P, C>;
}

/** The scope of the card a tab is on (`CardScope`) — for a tab every kind of card shares. */
export function cardScope(): Signal<CardScope> {
  return inject(LOADED_CARD).scope;
}

/** Moments of a card, in the panel's language and on the card's clock (`CardScope.timezone`). */
export type CardDates = {
  /** The day and the time. */
  dateTime(iso: string | null | undefined): string;
  /** The day alone: late evening UTC is already tomorrow in Chișinău. */
  day(iso: string | null | undefined): string;
};

/**
 * Reactive to the language and to the card: read inside a `computed` or a template. Made in an
 * injection context, on the scope of the card it is in unless given another.
 */
export function cardDates(scope: Signal<CardScope> = cardScope()): CardDates {
  const i18n = inject(I18nService);
  return {
    dateTime: (iso) => formatVenueDateTime(iso, i18n.locale(), scope().timezone),
    day: (iso) => formatVenueDate(iso, i18n.locale(), scope().timezone),
  };
}
