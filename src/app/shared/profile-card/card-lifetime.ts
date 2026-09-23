import {
  DestroyRef,
  inject,
  Injectable,
  linkedSignal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type Observable, Subscription } from 'rxjs';
import { ApiError } from '../../core/api/api-error';

/** What a card does with the answer to one of its requests. */
export type CardAnswer<T> = {
  /** The answer, while the opening that asked for it lasts. */
  next?: (value: T) => void;
  /** A refusal, likewise. The interceptor has already worded it; what was typed stays as typed. */
  error?: (error: unknown) => void;
  /** After either of them — where a pending state ends. */
  done?: () => void;
};

/** Why an opening has no profile to show. */
export type CardFailure = 'notFound' | 'failed';

/** Any refusal but `NOT_FOUND` has already been worded as a toast by the interceptor. */
export function cardFailure(error: unknown): CardFailure {
  return error instanceof ApiError && error.code === 'NOT_FOUND' ? 'notFound' : 'failed';
}

/**
 * The openings of one profile card, and the requests each of them sent.
 *
 * The router reuses a card between two profiles, and between two visits to the same one, so the
 * profile an answer is about cannot tell whether the answer still belongs on the card — only the
 * opening that asked for it can. A new opening drops every request of the last one: no answer, no
 * refusal and no `done` of theirs reaches the card again, and the state the card keeps per opening
 * starts over. Dropping an answer undoes nothing and claims nothing: what the backend did stays
 * done, and the next read shows it.
 *
 * Provided by the card's page next to the card's own state, so it lives as long as the card does.
 */
@Injectable()
export class CardLifetime {
  private readonly opening = signal(0);
  private requests = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.requests.unsubscribe());
  }

  /** The card opens anew — on another profile, or on the same one again. */
  renew(): void {
    this.requests.unsubscribe();
    this.requests = new Subscription();
    this.opening.update((opening) => opening + 1);
  }

  /** State that belongs to one opening: `initial` again whenever the card opens anew. */
  state<T>(initial: T): WritableSignal<T> {
    return linkedSignal({ source: this.opening, computation: () => initial });
  }

  /** Sends `request` for the current opening; `answer` hears of it only while it lasts. */
  run<T>(request: Observable<T>, answer: CardAnswer<T>): void {
    this.requests.add(
      request.subscribe({
        next: (value) => answer.next?.(value),
        error: (error: unknown) => {
          answer.error?.(error);
          answer.done?.();
        },
        complete: () => answer.done?.(),
      }),
    );
  }
}
