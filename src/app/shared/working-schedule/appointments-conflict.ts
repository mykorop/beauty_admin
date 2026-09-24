import {
  ApiError,
  SCHEDULE_CHANGE_HAS_APPOINTMENTS_CODE,
  TIME_OFF_HAS_APPOINTMENTS_CODE,
} from '../../core/api/api-error';

/** The days, on the venue's calendar, that hold the Записи in the way — and how many there are. */
export type AppointmentsConflict = { dates: string[]; appointmentCount: number };

/**
 * The refusals over live Записи a change of the Робочий графік would leave standing: a Відсутність
 * over them, or a week, a Ротація or Години роботи they no longer fit. Both carry the same
 * `details`; either is confirmed by the same request sent again with `allowExistingAppointments`.
 */
const CONFLICT_CODES: readonly string[] = [
  TIME_OFF_HAS_APPOINTMENTS_CODE,
  SCHEDULE_CHANGE_HAS_APPOINTMENTS_CODE,
];

/**
 * What stands in the way of a change, when that is why it was refused. The count is the domain's
 * whole one: the Записи listed beside it are capped, and the panel does not list them anyway.
 */
export function appointmentsConflict(error: unknown): AppointmentsConflict | null {
  if (!(error instanceof ApiError) || !CONFLICT_CODES.includes(error.code)) {
    return null;
  }
  const details = error.details as Partial<AppointmentsConflict> | undefined;
  return { dates: details?.dates ?? [], appointmentCount: details?.appointmentCount ?? 0 };
}
