import { inject, Injectable } from '@angular/core';
import { ApiError } from '../../core/api/api-error';
import { RequestScope } from '../request-scope';

/** Why an opening has no profile to show. */
export type CardFailure = 'notFound' | 'failed';

/** Any refusal but `NOT_FOUND` has already been worded as a toast by the interceptor. */
export function cardFailure(error: unknown): CardFailure {
  return error instanceof ApiError && error.code === 'NOT_FOUND' ? 'notFound' : 'failed';
}

/**
 * The openings of one profile card, and the requests each of them sent: the top level of the
 * request scope (`RequestScope`).
 *
 * The router reuses a card between two profiles, and between two visits to the same one, so the
 * profile an answer is about cannot tell whether the answer still belongs on the card — only the
 * opening that asked for it can. A new opening drops every request of the last one, and of every
 * list and element its tabs showed in it: no answer, no refusal and no `done` of theirs reaches the
 * card again, and the state the card keeps per opening starts over. Dropping an answer undoes
 * nothing and claims nothing: what the backend did stays done, and the next read shows it.
 *
 * Provided by the card (`ProfileCard`) next to its own state, so it lives as long as the card does.
 */
@Injectable()
export class CardLifetime extends RequestScope {
  // Its own, so the injector does not try to supply the outer level the scope's constructor takes.
  constructor() {
    super();
  }
}

/**
 * The level of a list: inside the opening of the card it is shown on, so a new opening drops what
 * the list asked — or a level of its own on a screen that is no card. Made in the list's injection
 * context, and ends with it.
 */
export function listLevel(): RequestScope {
  return inject(CardLifetime, { optional: true })?.nested() ?? new RequestScope();
}

/**
 * The level an action or an edit is bound to: the opening of the card it is taken on itself, not a
 * level inside it — a new opening drops the answer, while a tab left in the meantime does not, so
 * the card still takes in what the backend did. On a screen that is no card, a level of its own,
 * made in the injection context of whoever acts and ending with it.
 */
export function actionLevel(): RequestScope {
  return inject(CardLifetime, { optional: true }) ?? new RequestScope();
}
