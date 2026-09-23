const growth = (day: string, salons = 0, masters = 0, clients = 0) => ({
  day,
  salons,
  masters,
  clients,
});

const appointments = (day: string, counts: Record<string, number> = {}) => ({
  day,
  upcoming: 0,
  pastBooked: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  ...counts,
});

/** One profile of «Потребують уваги» — an active Салон unless told otherwise. */
const attention = (overrides: Record<string, unknown> = {}) => ({
  kind: 'salon',
  id: 's',
  salonId: null,
  salonName: null,
  name: 'Salon',
  city: 'Chișinău',
  createdAt: '2026-02-01T10:00:00.000Z',
  lastAppointmentAt: null,
  flags: [],
  gaps: [],
  ...overrides,
});

/**
 * A result built at noon on Wednesday 23 September 2026. The dashboard cuts its periods from the
 * result's own `today`, never from the browser's clock, so these figures read the same any day.
 */
export const detailedStatsResult = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  builtAt: '2026-09-23T09:00:00.000Z',
  timeZone: 'Europe/Chisinau',
  ratesUpdatedAt: '2026-09-23T06:00:00.000Z',
  scannedItems: 5000,
  today: '2026-09-23',
  growth: {
    daily: [
      growth('2026-09-21', 1, 0, 4),
      growth('2026-09-22', 0, 2, 3),
      growth('2026-09-23', 0, 0, 1),
    ],
    // The week of 24 August starts before a 30-day period and is still drawn whole.
    weekly: [growth('2026-08-24', 0, 0, 5), growth('2026-09-21', 1, 2, 8)],
    undated: 0,
  },
  appointments: {
    daily: [
      // Well before the last 30 days, still inside the default 90.
      appointments('2026-07-01', { completed: 5 }),
      appointments('2026-09-22', { completed: 2, pastBooked: 3, cancelled: 1 }),
      appointments('2026-09-23', { pastBooked: 1, upcoming: 1 }),
      appointments('2026-09-24'),
      appointments('2026-09-25', { upcoming: 2, cancelled: 1 }),
    ],
    undated: 0,
  },
  value: {
    currency: 'MDL',
    daily: [
      { day: '2026-07-01', past: 2000, ahead: 0 },
      { day: '2026-09-22', past: 1500, ahead: 0 },
      { day: '2026-09-23', past: 300, ahead: 450 },
      { day: '2026-09-24', past: 0, ahead: 0 },
      { day: '2026-09-25', past: 0, ahead: 900 },
    ],
    unconverted: 0,
  },
  tops: {
    window: { from: '2026-08-25', to: '2026-09-23' },
    salons: [
      { salonId: 's1', name: 'Beauty Lab', city: 'Chișinău', appointments: 42 },
      { salonId: 's2', name: 'Nails & Co', city: 'Bălți', appointments: 17 },
    ],
    independentMasters: [{ masterId: 'm1', name: 'Ana Rusu', city: 'Orhei', appointments: 9 }],
    cities: [
      { cityCode: '0100000', city: 'Chișinău', appointments: 42 },
      { cityCode: '0300000', city: 'Bălți', appointments: 17 },
      { cityCode: '6400000', city: 'Orhei', appointments: 9 },
    ],
  },
  quality: {
    window: { from: '2026-09-17', to: '2026-09-23' },
    reviews: 12,
    averageRating: 4.25,
    lowRated: 3,
    lowRatedProfiles: [
      { kind: 'salon', id: 's2', name: 'Nails & Co', lowRated: 2 },
      { kind: 'master', id: 'm1', name: 'Ana Rusu', lowRated: 1 },
    ],
  },
  attention: {
    window: { from: '2026-08-25', to: '2026-09-23' },
    items: [
      attention({
        id: 's3',
        name: 'Quiet Studio',
        lastAppointmentAt: '2026-07-14T09:00:00.000Z',
        flags: ['noRecentAppointments', 'incompleteProfile'],
        gaps: ['description', 'photos'],
      }),
      attention({
        kind: 'independentMaster',
        id: 'm4',
        name: 'Vera Lungu',
        city: 'Bălți',
        flags: ['noServices', 'noSchedule'],
      }),
      attention({
        kind: 'salonMaster',
        id: 'm9',
        salonId: 'dead',
        salonName: 'Salon Ex',
        name: 'Ion Rusu',
        createdAt: null,
        flags: ['inDeletedSalon'],
      }),
    ],
  },
  ...overrides,
});
