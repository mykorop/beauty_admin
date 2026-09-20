import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import type { TranslationKey } from '../../i18n/translations';

/** Placeholder for a section whose own ticket has not landed yet. */
@Component({
  selector: 'app-section-stub-page',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-2 text-2xl font-semibold" data-testid="section-title">{{ titleKey() | t }}</h1>
    <p class="text-slate-600">{{ 'stub.comingSoon' | t }}</p>
  `,
})
export class SectionStubPage {
  /** Bound from route `data` by `withComponentInputBinding()`. */
  readonly titleKey = input.required<TranslationKey>();
}
