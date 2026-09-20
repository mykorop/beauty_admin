import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Placeholder for a card tab whose own ticket has not landed yet. */
@Component({
  selector: 'app-card-tab-stub-page',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="text-slate-600" data-testid="card-tab-stub">{{ 'stub.comingSoon' | t }}</p>`,
})
export class CardTabStubPage {}
