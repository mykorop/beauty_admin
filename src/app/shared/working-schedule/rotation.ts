import type { SchedulePattern } from '../../core/api/master-schedule.model';

/** The domain's bounds of a cycle (`MIN_CYCLE_LENGTH` / `MAX_CYCLE_LENGTH`). */
export const MIN_CYCLE_LENGTH = 2;
export const MAX_CYCLE_LENGTH = 14;

/** `working[n]` — whether day `n + 1` of the cycle is worked; it may be longer than the cycle. */
export type RotationFormValue = { anchorDate: string; cycleLength: number; working: boolean[] };

/** A master without a Ротація opens on the commonest one: «2 через 2», counted from today. */
export function toRotationForm(
  stored: SchedulePattern | null,
  todayDate: string,
): RotationFormValue {
  const pattern = stored ?? { anchorDate: todayDate, cycleLength: 4, workingOffsets: [0, 1] };
  return {
    anchorDate: pattern.anchorDate,
    cycleLength: pattern.cycleLength,
    working: Array.from({ length: pattern.cycleLength }, (_, offset) =>
      pattern.workingOffsets.includes(offset),
    ),
  };
}

/**
 * The Ротація the form describes, or `null` while it breaks a rule of the domain: a cycle of 2–14
 * days with at least one day worked and at least one day off.
 */
export function buildRotation({
  anchorDate,
  cycleLength,
  working,
}: RotationFormValue): SchedulePattern | null {
  if (
    !anchorDate ||
    !Number.isInteger(cycleLength) ||
    cycleLength < MIN_CYCLE_LENGTH ||
    cycleLength > MAX_CYCLE_LENGTH
  ) {
    return null;
  }
  const workingOffsets = working
    .slice(0, cycleLength)
    .flatMap((worked, offset) => (worked ? [offset] : []));
  return workingOffsets.length === 0 || workingOffsets.length === cycleLength
    ? null
    : { anchorDate, cycleLength, workingOffsets };
}
