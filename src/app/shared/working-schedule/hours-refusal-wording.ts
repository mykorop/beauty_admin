import type { ApiError } from '../../core/api/api-error';
import type { I18nService } from '../../i18n/i18n.service';
import { weekdayName } from '../weekday';
import { hoursRefusals } from './week-hours';

/**
 * A refusal about hours, rule by rule, in the administrator's language — the week editor and the
 * Відсутність form word the same domain law the same way. A refusal that names no rule falls back
 * to the general sentence of its code.
 */
export function wordHoursRefusals(i18n: I18nService, error: ApiError): string[] {
  const locale = i18n.locale();
  const worded = hoursRefusals(error).map(({ key, dayOfWeek, masterName, slot, bounds }) => {
    const day = dayOfWeek === undefined ? '' : weekdayName(locale, dayOfWeek);
    return i18n.t(key, {
      // A day opens its sentence everywhere but in the master's.
      day: masterName === undefined ? day.charAt(0).toLocaleUpperCase(locale) + day.slice(1) : day,
      master: masterName,
      slot,
      bounds,
    });
  });
  return worded.length > 0 ? worded : [i18n.errorMessage(error.code)];
}
