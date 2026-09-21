import type { I18nService } from '../i18n/i18n.service';

/** A Категорія послуги in the panel's language; a label the panel does not know yet stays as stored. */
export function serviceCategoryLabel(i18n: I18nService, category: string): string {
  return category ? (i18n.optional(`category.${category}`) ?? category) : '—';
}
