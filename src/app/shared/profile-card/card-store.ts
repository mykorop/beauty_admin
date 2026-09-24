import { inject, Injectable, signal } from '@angular/core';
import { EMPTY, map, type Observable, tap } from 'rxjs';
import { ProfileClient } from '../../core/api/profile.client';
import { type CardFailure, cardFailure, CardLifetime } from './card-lifetime';
import type { CardAdapter, CardHeader, Loaded, Versioned } from './profile-card.model';

type Shown = Loaded<Versioned, unknown>;

/**
 * The openings of one profile card, whatever its kind, and what each of them has read. Provided by
 * `ProfileCard` next to its `CardLifetime`, so it lives as long as the card does.
 *
 * Every id the card is handed opens it anew: nothing asked for before can land on the new opening,
 * and what it keeps — the profile, the refusal — starts over. The profile is written here and
 * nowhere else: by the read of the opening, and by the answer to each change sent through here,
 * which becomes the card before the sender hears of it. The changes are cold: whoever sends one
 * binds it to the opening that asked.
 */
@Injectable()
export class CardStore {
  private readonly lifetime = inject(CardLifetime);
  private readonly profiles = inject(ProfileClient);

  private adapter: CardAdapter<unknown, Versioned, unknown> | null = null;
  private readonly openings = signal(0);
  private readonly current = this.lifetime.state<Shown | null>(null);
  private readonly failed = this.lifetime.state<CardFailure | null>(null);

  /** `null` until the opening has read its profile. */
  readonly loaded = this.current.asReadonly();
  /** Why the opening has nothing to show. */
  readonly failure = this.failed.asReadonly();
  /** Which opening this is: another number for each, never one again. */
  readonly opening = this.openings.asReadonly();

  /**
   * Opens the card on the profile `ids` name, as `adapter` reads it — anew: nothing asked for
   * before can land on it.
   */
  open(adapter: CardAdapter<unknown, Versioned, unknown>, ids: unknown): void {
    this.adapter = adapter;
    this.openings.update((openings) => openings + 1);
    this.lifetime.renew();
    this.lifetime.run(adapter.read(ids), {
      next: (loaded) => this.current.set(loaded),
      error: (error) => this.failed.set(cardFailure(error)),
    });
  }

  /**
   * Lays a Блокування, or lifts the one the card shows. The dialog's own button decided which way
   * this goes, so the state the card sees as it is sent decides — not the one the answer brings
   * back. Answers with the header the answer makes.
   */
  toggleBlock(reason: string): Observable<CardHeader> {
    const shown = this.current();
    const adapter = this.adapter;
    if (!shown || !adapter) {
      return EMPTY;
    }
    const scope = adapter.scope(shown);
    const request = adapter.header(shown).blocked
      ? this.profiles.unblock<Versioned>(scope, reason)
      : this.profiles.block<Versioned>(scope, reason);
    return this.accept(request).pipe(map((profile) => adapter.header({ ...shown, profile })));
  }

  /** Saves an edit of the Профіль under the `updatedAt` the card shows, where the kind has one. */
  update(change: { patch: object; reason?: string }): Observable<Versioned> {
    const shown = this.current();
    const path = shown && this.adapter?.scope(shown).capabilities.profileEdit;
    if (!shown || !path) {
      return EMPTY;
    }
    return this.accept(
      this.profiles.update<Versioned>(path, { updatedAt: shown.profile.updatedAt, ...change }),
    );
  }

  /** Reads the profile again, where the kind can. */
  reload(): Observable<Versioned> {
    const shown = this.current();
    const reload = shown && this.adapter?.reload?.(shown);
    return reload ? this.accept(reload) : EMPTY;
  }

  /** Any other change of the profile: `request`'s answer, folded into the profile, becomes the card. */
  change<T>(
    request: Observable<T>,
    fold: (profile: Versioned, answer: T) => Versioned,
  ): Observable<T> {
    return request.pipe(
      tap((answer) =>
        this.current.update((shown) => shown && { ...shown, profile: fold(shown.profile, answer) }),
      ),
    );
  }

  /** The answer becomes the card — header and every tab — before the sender hears of it. */
  private accept(request: Observable<Versioned>): Observable<Versioned> {
    return request.pipe(
      tap((profile) => this.current.update((shown) => shown && { ...shown, profile })),
    );
  }
}
