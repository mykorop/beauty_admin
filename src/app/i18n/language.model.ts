export const SUPPORTED_LANGUAGES = ['uk', 'ru', 'ro'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'uk';

export const LANGUAGE_LOCALES: Record<LanguageCode, string> = {
  uk: 'uk-UA',
  ru: 'ru-RU',
  ro: 'ro-RO',
};

/** Each language is named in itself, so the switcher reads the same whatever the current language. */
export const LANGUAGE_OPTIONS: readonly { code: LanguageCode; label: string }[] = [
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'ro', label: 'Română' },
];

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as LanguageCode);
}
