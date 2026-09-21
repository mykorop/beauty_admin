import { computed, Injectable, signal } from '@angular/core';
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  LANGUAGE_LOCALES,
  type LanguageCode,
} from './language.model';
import { type TranslationKey, TRANSLATIONS } from './translations';

export type TranslationParams = Record<string, string | number | boolean | null | undefined>;
type TranslationDictionary = Record<LanguageCode, Record<string, string>>;

/** Where the chosen language is persisted in the browser. */
export const LANGUAGE_STORAGE_KEY = 'bookme.admin.language';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _language = signal<LanguageCode>(readStoredLanguage() ?? DEFAULT_LANGUAGE);

  readonly language = this._language.asReadonly();
  readonly locale = computed(() => LANGUAGE_LOCALES[this._language()]);

  constructor() {
    this.syncDocumentLanguage(this._language());
  }

  setLanguage(language: unknown): void {
    const normalized = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
    this._language.set(normalized);
    persistLanguage(normalized);
    this.syncDocumentLanguage(normalized);
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    return this.lookup(key, params) ?? key;
  }

  /**
   * Wording for a backend `error.code`. A code with no dictionary entry is shown as it is: a raw
   * `SOME_NEW_CODE` on screen tells the administrator which domain law refused the change, while a
   * generic "something went wrong" would swallow it.
   */
  errorMessage(code: string): string {
    return this.lookup(`error.${code}`) ?? code;
  }

  /**
   * Wording for a key assembled from backend data (an audit action, a changed field), or `null`
   * when the dictionaries have none — the caller then shows the raw value rather than nothing.
   */
  optional(key: string): string | null {
    return this.lookup(key);
  }

  private lookup(key: string, params?: TranslationParams): string | null {
    const dictionaries: TranslationDictionary = TRANSLATIONS;
    const value = dictionaries[this._language()][key] ?? dictionaries[DEFAULT_LANGUAGE][key];
    return value === undefined ? null : interpolate(value, params);
  }

  private syncDocumentLanguage(language: LanguageCode): void {
    document.documentElement.lang = language;
  }
}

function interpolate(value: string, params?: TranslationParams): string {
  if (!params) {
    return value;
  }

  return value.replace(/\{\{\s*(\w+)\s*}}/g, (match, paramName: string) => {
    const paramValue = params[paramName];
    return paramValue === null || paramValue === undefined ? match : String(paramValue);
  });
}

function readStoredLanguage(): LanguageCode | null {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function persistLanguage(language: LanguageCode): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language persistence is best-effort; the signal remains the source of truth.
  }
}
