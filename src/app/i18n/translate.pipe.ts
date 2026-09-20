import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nService, type TranslationParams } from './i18n.service';
import type { TranslationKey } from './translations';

/** Impure on purpose: it reads the language signal, so a switch re-renders every label in place. */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: TranslationParams): string {
    return this.i18n.t(key, params);
  }
}
