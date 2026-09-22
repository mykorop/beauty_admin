import type { DayHours, SchedulePattern, TimeOffRequest } from './master-schedule.model';

/**
 * The bodies the Робочий графік writes, which are the same whether the Майстер is on a Ростер or
 * Незалежний — only the path differs. Kept here so the two clients cannot word one of them
 * differently: `patternType` is the discriminator the domain's schema expects, and a Журнал
 * `reason` is omitted rather than sent empty.
 */

/** A Журнал reason travels only when there is one. */
export const withReason = (reason: string | undefined) => (reason ? { reason } : {});

export const hoursBody = (days: DayHours[], reason?: string) => ({
  masterHours: days,
  ...withReason(reason),
});

export const schedulePatternBody = (pattern: SchedulePattern | null, reason?: string) => ({
  pattern: pattern && { patternType: 'CYCLE', ...pattern },
  ...withReason(reason),
});

/** `reason` here is the Журнал's; the one the Майстер's apps show travels inside `timeOff`. */
export const timeOffBody = (timeOff: TimeOffRequest, reason?: string) => ({
  timeOff,
  ...withReason(reason),
});
