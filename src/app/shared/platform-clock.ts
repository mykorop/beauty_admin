/**
 * The platform's own clock — BookMe's, not the browser's.
 *
 * Every screen that spans venues rather than standing inside one reads its days here: the Журнал
 * дій, the стрічка відгуків. "21 September" on those screens means the day as the BookMe team lived
 * it, and the browser's zone would move it under whoever opens the link. A screen that belongs to
 * one Салон or one Майстер uses that venue's zone instead (`venue-date.ts`).
 */
export const PLATFORM_TIME_ZONE = 'Europe/Chisinau';

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClockAsUtc - instant;
}

/**
 * The instant a `YYYY-MM-DD` day begins in `timeZone` — what a day filter in the address becomes
 * before it is sent, since every cross-venue endpoint takes instants.
 */
export function zonedDayStart(day: string, timeZone: string): string {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  // The offset is first read at the wrong moment (UTC midnight), then again at the moment it
  // pointed to — which differs from the first only on a day the clocks change.
  const guess = utcMidnight - zoneOffsetMs(utcMidnight, timeZone);
  return new Date(utcMidnight - zoneOffsetMs(guess, timeZone)).toISOString();
}
