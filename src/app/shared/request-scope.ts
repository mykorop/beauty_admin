import {
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { type Observable, Subscription } from 'rxjs';

/** What the asker does with the answer to one of its requests. */
export type ScopedAnswer<T> = {
  /** The answer, while the opening of the level that asked for it lasts. */
  next?: (value: T) => void;
  /** A refusal, likewise. The interceptor has already worded it; what was typed stays as typed. */
  error?: (error: unknown) => void;
  /** After either of them — where a pending state ends. */
  done?: () => void;
};

/**
 * One level of the scope every answer of the panel is bound to. The levels nest: the opening of a
 * card, the list shown in it, the element open in that list.
 *
 * The screen keeps changing under a slow answer — the card reopens on another profile, the list is
 * shown anew under other filters, another element is opened — so an answer must find what asked
 * for it, or nothing at all. A level opens anew with `renew`: the requests of its last opening and
 * of every level inside it are dropped — no answer, no refusal and no `done` of theirs is heard
 * again — and the state kept per opening of each of them starts over. The levels around it are
 * left as they are. Dropping an answer undoes nothing and claims nothing: what the backend did
 * stays done, and the next read shows it.
 *
 * Made in an injection context; the level ends with it, and nothing asked in it is heard after.
 */
export class RequestScope {
  private readonly renewals = signal(0);
  /** Grows with every renewal of this level and of each level around it; never repeats. */
  private readonly opening: Signal<number>;
  /** The requests of this opening, with those of every level inside it. */
  private requests = Subscription.EMPTY;
  private ended = false;

  constructor(private readonly outer: RequestScope | null = null) {
    this.opening = outer
      ? computed(() => outer.opening() + this.renewals())
      : this.renewals.asReadonly();
    inject(DestroyRef).onDestroy(() => {
      this.ended = true;
      this.requests.unsubscribe();
    });
  }

  /** A level inside this one, made in an injection context: it starts over whenever this one does. */
  nested(): RequestScope {
    return new RequestScope(this);
  }

  /** The level opens anew — and every level inside it with it. */
  renew(): void {
    this.requests.unsubscribe();
    this.renewals.update((renewals) => renewals + 1);
  }

  /** State that belongs to one opening: `initial` again whenever this level or one around it opens anew. */
  state<T>(initial: T): WritableSignal<T> {
    return linkedSignal({ source: this.opening, computation: () => initial });
  }

  /** Sends `request` for the current opening; `answer` hears of it only while it lasts. */
  run<T>(request: Observable<T>, answer: ScopedAnswer<T>): void {
    const requests = this.current();
    if (requests.closed) {
      return;
    }
    requests.add(
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

  /** The requests of this opening, begun on first use inside those of the level around it. */
  private current(): Subscription {
    if (this.requests.closed && !this.ended) {
      const requests = new Subscription();
      // Closed at once if the level around has ended.
      this.outer?.current().add(requests);
      this.requests = requests;
    }
    return this.requests;
  }
}
