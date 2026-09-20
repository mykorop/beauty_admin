import type { LanguageCode } from './language.model';
import { RO_TRANSLATIONS } from './translations/ro';
import { RU_TRANSLATIONS } from './translations/ru';
import { UK_TRANSLATIONS } from './translations/uk';
import type { TranslationKey } from './translations/uk';

export const TRANSLATIONS = {
  uk: UK_TRANSLATIONS,
  ru: RU_TRANSLATIONS,
  ro: RO_TRANSLATIONS,
} as const satisfies Record<LanguageCode, Record<string, string>>;

export type { TranslationKey };
