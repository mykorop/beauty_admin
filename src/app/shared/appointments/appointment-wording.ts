import type { AppointmentStatus } from '../../core/api/appointments.client';
import { APPOINTMENT_STATUSES } from '../../core/api/appointments.client';
import type { I18nService } from '../../i18n/i18n.service';

/**
 * How the panel words a Запис it did not write itself.
 *
 * The backend passes a damaged row through rather than inventing a state, a price or a currency
 * for it, so both screens here have to be able to show one honestly: an unknown state is printed
 * as it came — the panel's rule for anything it has no wording for, as with error codes and audit
 * actions — and a missing number as «—», never as `0` or `NaN`.
 */
export function appointmentStatusLabel(i18n: I18nService, status: AppointmentStatus): string {
  const known = APPOINTMENT_STATUSES.find((value) => value === status);
  return known ? i18n.t(`appointments.status.${known}`) : (status ?? '—');
}

export function formatPrice(money: Intl.NumberFormat, amount: number): string {
  return Number.isFinite(amount) ? money.format(amount) : '—';
}
