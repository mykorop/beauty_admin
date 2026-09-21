import type { I18nService } from '../i18n/i18n.service';

/** A specialization in the panel's language; a value the panel does not know yet stays as stored. */
export function specializationLabel(i18n: I18nService, specialization: string): string {
  return specialization ? (i18n.optional(`specialization.${specialization}`) ?? specialization) : '—';
}
