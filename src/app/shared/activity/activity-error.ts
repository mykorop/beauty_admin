import type { ActivityError } from '../../core/api/activity.client';

/** One field a request failed the check on: where it stood (`body · startTime`) and what was wrong. */
export type FailedField = { field: string; messages: string };

/**
 * The fields a `VALIDATION_ERROR` refused, as the backend's validator writes them: per part of the
 * request (`body`, `query`, `pathParameters`), the messages of each dotted field path — `_root` for
 * the part as a whole. `null` for any other answer, and for details of any other shape, which are
 * then shown as they came.
 */
export function failedFieldsOf(error: ActivityError | null): FailedField[] | null {
  if (error?.code !== 'VALIDATION_ERROR' || !isRecord(error.details)) {
    return null;
  }
  const fields: FailedField[] = [];
  for (const [part, paths] of Object.entries(error.details)) {
    if (!isRecord(paths)) {
      return null;
    }
    for (const [path, messages] of Object.entries(paths)) {
      if (!Array.isArray(messages)) {
        return null;
      }
      fields.push({ field: path === '_root' ? part : `${part} · ${path}`, messages: messages.join('; ') });
    }
  }
  return fields.length > 0 ? fields : null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
