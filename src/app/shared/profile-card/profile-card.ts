import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';

/** One tab of a profile card; `path` is the child route it lives under, so it can be linked to. */
export type ProfileCardTab = { path: string; labelKey: TranslationKey };

/**
 * The frame of a profile card: a way back, the title, the tab strip and the outlet the chosen tab
 * renders into. It knows nothing about whose profile it is — the Салон and the Незалежний майстер
 * pages hand it their own tabs and project their state (`cardStatus`) and warnings (`cardBanner`).
 */
@Component({
  selector: 'app-profile-card',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:underline" [routerLink]="backLink()">
      <i class="pi pi-arrow-left" aria-hidden="true"></i>
      {{ backLabelKey() | t }}
    </a>
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold" data-testid="card-title">{{ title() || '—' }}</h1>
      <ng-content select="[cardStatus]" />
    </div>
    <ng-content select="[cardBanner]" />
    <nav class="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
      @for (tab of tabs(); track tab.path) {
        <a
          class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
          data-testid="card-tab"
          [routerLink]="[tab.path]"
          routerLinkActive="!border-slate-900 font-semibold !text-slate-900"
          ariaCurrentWhenActive="page"
          >{{ tab.labelKey | t }}</a
        >
      }
    </nav>
    <router-outlet />
  `,
})
export class ProfileCard {
  readonly title = input.required<string>();
  readonly tabs = input.required<readonly ProfileCardTab[]>();
  readonly backLink = input.required<string>();
  readonly backLabelKey = input.required<TranslationKey>();
}
