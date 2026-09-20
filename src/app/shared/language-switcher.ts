import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { I18nService } from '../i18n/i18n.service';
import { LANGUAGE_OPTIONS } from '../i18n/language.model';
import { TranslatePipe } from '../i18n/translate.pipe';

@Component({
  selector: 'app-language-switcher',
  imports: [FormsModule, Select, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-select
      data-testid="language-switcher"
      [options]="options"
      optionLabel="label"
      optionValue="code"
      [ngModel]="i18n.language()"
      (ngModelChange)="i18n.setLanguage($event)"
      [ariaLabel]="'header.language' | t"
      size="small"
    />
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18nService);
  protected readonly options = [...LANGUAGE_OPTIONS];
}
