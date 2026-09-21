/** One window of a working day, `HH:mm` on the venue's clock. */
export type TimeSlot = { start: string; end: string };

/** One day of a stored week — a Салон's Години роботи or a Майстер's тижневі години. 0 = Sunday. */
export type DayHours = { dayOfWeek: number; isOpen: boolean; slots: TimeSlot[] };

/** Ротація: a cycle laid over the week from `anchorDate`; it takes days off, never opens one. */
export type SchedulePattern = { anchorDate: string; cycleLength: number; workingOffsets: number[] };

export type TimeOffType = 'DAY_OFF' | 'CUSTOM_HOURS' | 'BLOCKED';

/** One Відсутність, with the bounds it was created with. */
export type TimeOffGroup = {
  groupId: string;
  type: TimeOffType;
  fromDate: string;
  toDate: string;
  /** Dates inside the bounds the Відсутність does not cover. */
  skippedDates?: string[];
  /** The window still worked — only for `CUSTOM_HOURS`. */
  slots: TimeSlot[];
  reason?: string;
  createdAt: string;
};

/** One Запис as the calendar needs it; the instants are UTC. */
export type ScheduleAppointment = {
  appointmentId: string;
  startTime: string;
  endTime: string;
  status: string;
};

/**
 * The Робочий графік of a Майстер over a window of dates. Says nothing about whether he works in a
 * Салон: the editor and the calendar are the same for a Незалежний майстер.
 */
export type MasterSchedule = {
  weeklyHours: DayHours[];
  schedulePattern: SchedulePattern | null;
  timeOff: TimeOffGroup[];
  appointments: ScheduleAppointment[];
  /** Today on the venue's clock, `YYYY-MM-DD`. */
  todayDate: string;
  timezone: string;
};
