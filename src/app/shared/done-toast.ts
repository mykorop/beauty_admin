import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { I18nService, type TranslationParams } from '../i18n/i18n.service';
import type { TranslationKey } from '../i18n/translations';

/** How a change the backend agreed to is told. */
export type DoneToast = {
  key: TranslationKey;
  params?: TranslationParams;
  /** It happened, but not all of it — a run that left Записи behind, a Копія that already was. */
  warn?: boolean;
};

/** «Зміни збережено.» — how an edit is told unless its form says otherwise. */
export const SAVED_TOAST: DoneToast = { key: 'salon.edit.saved' };

/**
 * Tells a success the way every action and every form of the panel tells it: a short toast, or a
 * warning that stays longer when the answer says the change fell short. A refusal is not told here
 * — the interceptor has worded it already. Made in an injection context.
 */
export function doneToasts(): (toast: DoneToast) => void {
  const messages = inject(MessageService);
  const i18n = inject(I18nService);
  return ({ key, params, warn }) =>
    messages.add({
      severity: warn ? 'warn' : 'success',
      summary: i18n.t(key, params),
      life: warn ? 8000 : 4000,
    });
}
