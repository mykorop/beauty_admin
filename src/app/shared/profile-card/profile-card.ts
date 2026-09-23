import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';

/** One tab of a profile card; `path` is the child route it lives under, so it can be linked to. */
export type ProfileCardTab = { path: string; labelKey: TranslationKey };

/**
 * The frame of a profile card: a way back, the title, the tab strip and the outlet the chosen tab
 * renders into. It knows nothing about whose profile it is — the Салон and the Незалежний майстер
 * pages hand it their own tabs and project their state (`cardStatus`), the actions that act on the
 * profile as a whole (`cardActions`), the card they sit inside (`cardContext`) and warnings
 * (`cardBanner`).
 */
@Component({
  selector: 'app-profile-card',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-card' },
  template: `
    <a class="profile-back" data-testid="card-back" [routerLink]="backLink()">
      <i class="pi pi-arrow-left" aria-hidden="true"></i>
      {{ backLabelKey() | t }}
    </a>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]" data-testid="card-title">
        {{ title() || '—' }}
      </h1>
      <ng-content select="[cardStatus]" />
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <ng-content select="[cardActions]" />
      </div>
    </div>
    <ng-content select="[cardContext]" />
    <ng-content select="[cardBanner]" />
    <nav class="profile-tabs">
      @for (tab of tabs(); track tab.path) {
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
export class ProfileCard {
  readonly title = input.required<string>();
  readonly tabs = input.required<readonly ProfileCardTab[]>();
  readonly backLink = input.required<string>();
  readonly backLabelKey = input.required<TranslationKey>();
}
