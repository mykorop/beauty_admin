import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UpcomingAppointments } from '../appointments/upcoming-appointments';
import { BlockAction } from '../block-action/block-action';
import { reasonAction } from '../reason-dialog/reason-action';
import { CardStore } from './card-store';
import { cardDates, LOADED_CARD, type LoadedCardOfKind } from './loaded-card';
import type { CardAdapter, Loaded, ProfileCardKind, Versioned } from './profile-card.model';

/**
 * A profile card whose profile has loaded: the way back, the title and the state tag, the banners
 * that explain a state that is not active, Блокування, the tab strip and the tab in it. The kind
 * only says what its profile is called and how it reads (`ProfileCardKind`); everything else is
 * the same on every card.
 *
 * Блокування is offered here rather than on a tab — it is about the whole profile, and the banner
 * that explains the state sits right under the button. So is «N майбутніх Записів»: it is the
 * Клієнти of this profile that Блокування leaves standing, and the number belongs next to the
 * decision that created them, not inside the Записи tab.
 *
 * It is the one place the loaded profile is handed to the tabs (`LOADED_CARD`), and it exists only
 * while there is one: built anew for each opening of the card (`ProfileCard`), with every tab in it.
 */
@Component({
  selector: 'app-loaded-profile-card',
  imports: [
    BlockAction,
    Message,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    Tag,
    TranslatePipe,
    UpcomingAppointments,
  ],
  providers: [{ provide: LOADED_CARD, useFactory: () => inject(LoadedProfileCard).handOver() }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-card' },
  template: `
    @let header = view();
    <a class="profile-back" data-testid="card-back" [routerLink]="backLink()">
      <i class="pi pi-arrow-left" aria-hidden="true"></i>
      {{ kind().back.labelKey | t }}
    </a>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]" data-testid="card-title">
        {{ header.title || '—' }}
      </h1>
      <p-tag
        data-testid="card-status"
        [severity]="header.tag.severity"
        [value]="header.tag.labelKey | t"
      />
      @if (header.owner) {
        <p-tag severity="info" data-testid="card-owner" [value]="'roster.ownerMaster' | t" />
      }
      <div class="ml-auto flex flex-wrap items-center gap-2">
        @if (blockable()) {
          <app-block-action
            [blocked]="!!header.blocked"
            [subject]="header.subject"
            [action]="block"
            [upcomingCount]="upcomingCount()"
            (cancelUpcoming)="offerUpcomingCancel()"
          />
        }
      </div>
    </div>
    @if (header.context; as context) {
      @if (context.kind === 'salon') {
        <p class="profile-context -mt-2 mb-4 text-sm text-muted" data-testid="card-context">
          {{ 'salonMaster.inSalon' | t }}
          <a class="font-medium hover:underline" [routerLink]="['/salons', context.salonId]">{{
            context.name || '—'
          }}</a>
        </p>
      } @else {
        <p class="profile-context -mt-2 mb-4 text-sm text-muted" data-testid="card-former-salon">
          {{ 'master.formerSalon' | t: { salon: context.name, date: dates.day(context.leftAt) } }}
        </p>
      }
    }
    @if (header.deleted; as deleted) {
      <p-message
        class="mb-4 block"
        severity="error"
        icon="pi pi-trash"
        data-testid="card-deleted-banner"
      >
        {{
          deleted.at
            ? (kind().copy.deletedBanner | t: { date: dates.dateTime(deleted.at) })
            : (kind().copy.deletedBannerNoDate | t)
        }}
      </p-message>
    }
    @if (header.blocked; as blocked) {
      @if (kind().copy.blockedBanner; as banner) {
        <p-message
          class="mb-4 block"
          severity="warn"
          icon="pi pi-ban"
          data-testid="card-blocked-banner"
        >
          {{ banner | t: { date: dates.dateTime(blocked.at), reason: blocked.reason || '—' } }}
        </p-message>
      }
    }
    @if (scope().capabilities.bulkCancel) {
      <app-upcoming-appointments
        [subject]="header.subject"
        [warn]="!header.active"
        [asked]="block.open()"
        [(count)]="upcomingCount"
      />
    }
    <nav class="profile-tabs">
      @for (tab of kind().tabs; track tab.path) {
        <a
          class="profile-tab"
          data-testid="card-tab"
          [routerLink]="[tab.path]"
          routerLinkActive="is-active"
          ariaCurrentWhenActive="page"
          >{{ tab.labelKey | t }}</a
        >
      }
    </nav>
    <section class="profile-content">
      <router-outlet />
    </section>
  `,
})
export class LoadedProfileCard {
  private readonly store = inject(CardStore);

  readonly kind = input.required<ProfileCardKind<unknown, Versioned, unknown>>();
  /** The kind's own adapter — resolved once, by the card. */
  readonly adapter = input.required<CardAdapter<unknown, Versioned, unknown>>();
  readonly loaded = input.required<Loaded<Versioned, unknown>>();

  protected readonly view = computed(() => this.adapter().header(this.loaded()));
  protected readonly scope = computed(() => this.adapter().scope(this.loaded()));
  protected readonly backLink = computed(() => this.kind().back.link(this.loaded()));
  protected readonly dates = cardDates(this.scope);

  /** Where the kind offers it, and never on a Видалений profile — every write action refuses there. */
  protected readonly blockable = computed(
    () => this.scope().capabilities.block && this.scope().writable,
  );

  /** Блокування, or its lifting — which way is the profile's state as the reason is confirmed. */
  protected readonly block = reasonAction({
    run: (reason) => this.store.toggleBlock(reason),
    toast: (header) => (header.blocked ? 'block.done' : 'unblock.done'),
  });

  /** Filled by `app-upcoming-appointments`; the Блокування dialog states it before it asks. */
  protected readonly upcomingCount = signal<number | null>(null);

  private readonly upcoming = viewChild(UpcomingAppointments);

  /**
   * The Блокування dialog offered the масове скасування and the administrator took it. Блокування
   * itself is left alone: the two decisions each keep their own confirmation and their own reason.
   */
  protected offerUpcomingCancel(): void {
    this.block.dismiss();
    this.upcoming()?.ask();
  }

  /** What the tabs are given (`LOADED_CARD`): made once, for whichever asks for it first. */
  handOver(): LoadedCardOfKind {
    return {
      kind: this.kind(),
      profile: computed(() => this.loaded().profile),
      context: computed(() => this.loaded().context),
      scope: this.scope,
      update: (change) => this.store.update(change),
      reload: () => this.store.reload(),
      change: (request, fold) => this.store.change(request, fold),
    };
  }
}
