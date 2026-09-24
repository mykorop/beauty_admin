/** A refusal from `admin-api`, or a transport failure dressed as one (`NETWORK_ERROR`). */
export class ApiError extends Error {
  constructor(
    /** The backend's stable `error.code`; what the UI translates and what callers branch on. */
    readonly code: string,
    /** The backend's English message — for logs, never for the screen. */
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/** The record changed after the form was opened; every edit form answers it by offering a reload. */
export const EDIT_CONFLICT_CODE = 'EDIT_CONFLICT';

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/** New Години роботи would leave a Майстер салону working outside them; `details.masters` names them. */
export const ROSTER_HOURS_OUTSIDE_SALON_HOURS_CODE = 'ROSTER_HOURS_OUTSIDE_SALON_HOURS';

/** A Майстер салону's week would stick out of the Години роботи of his Салон; `details` names the day. */
export const MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE = 'MASTER_HOURS_OUTSIDE_SALON_HOURS';

/** Live Записи stand inside a Відсутність; `details` names the days, and the same request confirms it. */
export const TIME_OFF_HAS_APPOINTMENTS_CODE = 'TIME_OFF_HAS_APPOINTMENTS';

/**
 * Live Записи would no longer fit a new week or Години роботи — for Години роботи, those of any
 * Майстер on the Ростер. `details` is shaped as for a Відсутність, and the same request confirms it.
 * The backend does not yet check a Ротація against Записи; its section already answers the refusal
 * so it needs nothing the day the backend starts sending it there.
 */
export const SCHEDULE_CHANGE_HAS_APPOINTMENTS_CODE = 'SCHEDULE_CHANGE_HAS_APPOINTMENTS';

/**
 * Refusals of a weekly-hours save the editor words itself: the broken rule their `details` carry,
 * rule by rule, or the Записи in the way. The clients leave them to the caller instead of a toast.
 */
export const HOURS_REFUSAL_CODES: readonly string[] = [
  VALIDATION_ERROR_CODE,
  ROSTER_HOURS_OUTSIDE_SALON_HOURS_CODE,
  MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE,
  SCHEDULE_CHANGE_HAS_APPOINTMENTS_CODE,
];

/**
 * Refusals of a Ротація its form words itself: the Записи the new cycle would leave standing — once
 * the backend checks a Ротація against them, which it does not yet.
 */
export const ROTATION_REFUSAL_CODES: readonly string[] = [SCHEDULE_CHANGE_HAS_APPOINTMENTS_CODE];

/** Refusals of a Відсутність its form words itself: what is in the way, or the window that sticks out. */
export const TIME_OFF_REFUSAL_CODES: readonly string[] = [
  TIME_OFF_HAS_APPOINTMENTS_CODE,
  MASTER_HOURS_OUTSIDE_SALON_HOURS_CODE,
];
