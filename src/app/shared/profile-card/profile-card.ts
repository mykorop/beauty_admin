import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  untracked,
} from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CardLifetime } from './card-lifetime';
import { CardStore } from './card-store';
import { LoadedProfileCard } from './loaded-profile-card';
import type { ProfileCardKind, Versioned } from './profile-card.model';

/**
 * A profile card, of whichever kind: opens on the profile its ids name, and opens anew on every
 * other id the router hands it. While the profile is read it shows nothing; then either the loaded
 * card (`LoadedProfileCard`) or why there is none — a profile that is not there, or a read that
 * failed, which the interceptor has already worded as a toast.
 *
 * A Видалений profile opens like any other, under a banner that says it is read-only.
 */
@Component({
  selector: 'app-profile-card',
  imports: [LoadedProfileCard, TranslatePipe],
  providers: [CardLifetime, CardStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <!-- Keyed by the opening: the card and every tab in it are built anew for each one, however
    soon its profile lands. -->
    @for (shown of shown(); track shown.opening) {
      <app-loaded-profile-card [kind]="kind()" [adapter]="adapter()" [loaded]="shown.loaded" />
    } @empty {
      @if (store.failure() === 'notFound') {
        <p class="text-muted" data-testid="card-not-found">{{ kind().copy.notFound | t }}</p>
      } @else if (store.failure() === 'failed') {
        <p class="text-muted" data-testid="card-failed">{{ 'card.failed' | t }}</p>
      }
    }
  `,
})
export class ProfileCard<I, P extends Versioned, C> {
  private readonly injector = inject(Injector);
  protected readonly store = inject(CardStore);

  readonly kind = input.required<ProfileCardKind<I, P, C>>();
  /** Whose card: one id, or a pair — as the kind's adapter reads them. */
  readonly ids = input.required<I>();

  protected readonly adapter = computed(() => this.injector.get(this.kind().adapter));

  protected readonly shown = computed(() => {
    const loaded = this.store.loaded();
    return loaded ? [{ opening: this.store.opening(), loaded }] : [];
  });

  constructor() {
    // The router reuses a card between two profiles, and between two visits to one: every id it is
    // handed opens the card anew.
    effect(() => {
      const adapter = this.adapter();
      const ids = this.ids();
      untracked(() => this.store.open(adapter, ids));
    });
  }
}
