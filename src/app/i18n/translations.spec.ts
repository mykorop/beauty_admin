import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './language.model';
import { TRANSLATIONS } from './translations';

describe('translation dictionaries', () => {
  const dictionaries: Record<string, Record<string, string>> = TRANSLATIONS;
  const referenceKeys = Object.keys(dictionaries[DEFAULT_LANGUAGE]).sort();

  for (const language of SUPPORTED_LANGUAGES) {
    it(`${language} has exactly the keys of ${DEFAULT_LANGUAGE}`, () => {
      const keys = Object.keys(dictionaries[language]).sort();
      const missing = referenceKeys.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !referenceKeys.includes(key));

      expect(missing).withContext(`missing in ${language}`).toEqual([]);
      expect(extra).withContext(`only in ${language}`).toEqual([]);
    });

    it(`${language} has no empty wording`, () => {
      const empty = Object.entries(dictionaries[language])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);

      expect(empty).toEqual([]);
    });

    it(`${language} uses the same interpolation params as ${DEFAULT_LANGUAGE}`, () => {
      const paramsOf = (value: string): string[] =>
        [...value.matchAll(/\{\{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
      const mismatched = referenceKeys.filter(
        (key) =>
          paramsOf(dictionaries[language][key] ?? '').join() !==
          paramsOf(dictionaries[DEFAULT_LANGUAGE][key]).join(),
      );

      expect(mismatched).toEqual([]);
    });
  }
});
