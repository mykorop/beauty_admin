import { zonedDayStart } from './platform-clock';

describe('zonedDayStart', () => {
  it('is midnight on the platform’s clock, in summer and in winter', () => {
    expect(zonedDayStart('2026-09-01', 'Europe/Chisinau')).toBe('2026-08-31T21:00:00.000Z');
    expect(zonedDayStart('2026-01-15', 'Europe/Chisinau')).toBe('2026-01-14T22:00:00.000Z');
  });

  it('holds on the days the clocks change', () => {
    // 29 March 2026: 02:00 → 03:00. Midnight is still on winter time, the next one on summer time.
    expect(zonedDayStart('2026-03-29', 'Europe/Chisinau')).toBe('2026-03-28T22:00:00.000Z');
    expect(zonedDayStart('2026-03-30', 'Europe/Chisinau')).toBe('2026-03-29T21:00:00.000Z');
    expect(zonedDayStart('2026-10-25', 'Europe/Chisinau')).toBe('2026-10-24T21:00:00.000Z');
    expect(zonedDayStart('2026-10-26', 'Europe/Chisinau')).toBe('2026-10-25T22:00:00.000Z');
  });

  it('works west of Greenwich too', () => {
    expect(zonedDayStart('2026-09-01', 'America/Los_Angeles')).toBe('2026-09-01T07:00:00.000Z');
  });
});
