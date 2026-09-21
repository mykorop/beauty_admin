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
