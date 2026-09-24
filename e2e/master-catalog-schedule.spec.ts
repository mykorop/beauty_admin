import type { Page } from '@playwright/test';
import { apiError, apiOk, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * The Каталог послуг and the Робочий графік of a Незалежний майстер — the same editors the Салон
 * card uses, on his own path. What these specs are really about is the two places where the screen
 * has to say less than the Салон's: no Копії майстра anywhere in the Каталог, and no Години роботи
 * Салону beside the week.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SERVICES_PATH = '/admin/masters/m1/services';
const SCHEDULE = 'GET /admin/masters/m1/schedule';
const PUT_HOURS = 'PUT /admin/masters/m1/hours';

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
  description: 'Barber since 2019',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
  locationLatitude: '47.0245',
  locationLongitude: '28.8323',
  phone: '+37360000001',
  email: 'ion@bookme.md',
  specialization: 'barber',
  timezone: 'Europe/Chisinau',
  rating: 4.6,
  reviewCount: 7,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: '#aa3366',
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  salon: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

/** A service of his own Каталог: no `masterCopyCount`, because there is no Ростер under it. */
const service = (overrides: Record<string, unknown> = {}) => ({
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

const DICTIONARIES = apiOk({
  serviceCategories: ['haircut', 'styling', 'beard_and_mustache'],
  specializations: ['barber'],
  serviceCurrencies: ['MDL'],
});

const open = (dayOfWeek: number, start = '09:00', end = '18:00') => ({
  dayOfWeek,
  isOpen: true,
  slots: [{ start, end }],
});
const closed = (dayOfWeek: number) => ({ dayOfWeek, isOpen: false, slots: [] });

/** A week no Салон could bound: he works Saturdays, and starts before any salon opens. */
const MASTER_WEEK = [
  closed(0),
  open(1, '07:00', '20:00'),
  open(2),
  open(3),
  open(4),
  open(5),
  open(6, '10:00', '16:00'),
];

const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The calendar opens on the current month, so the mock answers relative to the window it is asked
 * for: `from` is always a Monday, which makes `from + 7` the Monday of the grid's second week.
 */
const schedule = (url: URL, weeklyHours: unknown[] = MASTER_WEEK): MockResponse => {
  const from = url.searchParams.get('from') ?? '';
  return apiOk({
    weeklyHours,
    schedulePattern: null,
    timeOff: [
      {
        groupId: 'g1',
        type: 'DAY_OFF',
        fromDate: addDays(from, 8),
        toDate: addDays(from, 9),
        slots: [],
        reason: 'Conference',
        createdAt: '2026-09-01T08:00:00.000Z',
      },
    ],
    appointments: [
      {
        appointmentId: 'a1',
        startTime: `${addDays(from, 7)}T08:00:00Z`,
        endTime: `${addDays(from, 7)}T09:00:00Z`,
        status: 'BOOKED',
      },
    ],
    todayDate: addDays(from, 7),
    timezone: 'Europe/Chisinau',
  });
};

const upcomingCountRoute = (overrides: Record<string, unknown>): MockRoutes =>
  // A card that is not active warns about the Записи still ahead of it (§12), and reads the count.
  overrides['status'] ? { 'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }) } : {};

const catalogRoutes = (items: unknown[], masterOverrides: Record<string, unknown> = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/masters/m1': apiOk(master(masterOverrides)),
  ...upcomingCountRoute(masterOverrides),
  'GET /admin/dictionaries': DICTIONARIES,
  [`GET ${SERVICES_PATH}`]: apiOk({ items }),
});

const scheduleRoutes = (extra: MockRoutes = {}, masterOverrides: Record<string, unknown> = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/masters/m1': apiOk(master(masterOverrides)),
  ...upcomingCountRoute(masterOverrides),
  [SCHEDULE]: (url: URL) => schedule(url),
  ...extra,
});

/** Rows are Monday first: row 0 is Monday, row 6 Sunday. */
const weekRow = (page: Page, index: number) => page.getByTestId('schedule-day').nth(index);
const editRow = (page: Page, index: number) => page.getByTestId('hours-edit-day').nth(index);
const rotationDay = (page: Page, index: number) => page.getByTestId('rotation-day').nth(index);

test.describe('independent master service catalog', () => {
  test('lists his own Каталог, with no Копії column and no cascade warning', async ({ page, mockBackend }) => {
    await mockBackend(
      ADMIN,
      catalogRoutes([
        service(),
        service({ serviceId: 'svc2', name: 'Beard trim', category: 'beard_and_mustache', isActive: false }),
      ]),
    );
    await signIn(page, ADMIN, '/independent-masters/m1/services');

    const rows = page.getByTestId('service-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId('service-row-name')).toHaveText('Haircut');
    await expect(rows.nth(0).getByTestId('service-row-category')).toHaveText('Стрижки');
    await expect(rows.nth(0).getByTestId('service-row-duration')).toHaveText('30 хв');
    await expect(rows.nth(0).getByTestId('service-row-price')).toContainText('500');
    await expect(rows.nth(0).getByTestId('service-row-currency')).toHaveText('MDL');
    await expect(rows.nth(1).getByTestId('service-row-active')).toHaveText('Деактивована');

    // Nothing here belongs to the Салон half of the Каталог.
    await expect(page.getByTestId('service-row-copies')).toHaveCount(0);
    await expect(page.getByTestId('services-copies-note')).toHaveCount(0);
    await expect(page.getByTestId('services-own-catalog-note')).toBeVisible();
  });

  test('creates a service in MDL only, priced as the Клієнт will book it', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...catalogRoutes([]),
      [`POST ${SERVICES_PATH}`]: {
        status: 201,
        body: apiOk(
          service({
            serviceId: 'svc9',
            name: 'Beard trim',
            category: 'beard_and_mustache',
            durationMinutes: 20,
            price: 250,
          }),
        ).body,
      },
    });
    await signIn(page, ADMIN, '/independent-masters/m1/services');
    await expect(page.getByTestId('services-empty')).toBeVisible();

    await page.getByTestId('service-new').click();
    await expect(page.getByTestId('service-mdl-only')).toBeVisible();

    await page.getByTestId('service-name').fill('Beard trim');
    await page.getByTestId('service-category').click();
    await page.getByRole('option', { name: 'Барберинг' }).click();
    await page.getByTestId('service-duration').fill('20');
    await page.getByTestId('service-price').fill('250');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('service-row-name')).toHaveText('Beard trim');
    expect(mock.bodies[`POST ${SERVICES_PATH}`]).toEqual([
      {
        name: 'Beard trim',
        description: '',
        category: 'beard_and_mustache',
        durationMinutes: 20,
        price: 250,
        currency: 'MDL',
        isActive: true,
      },
    ]);
  });

  test('never warns about Копії — a new price is the one Клієнти book at', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...catalogRoutes([service()]),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiOk(service({ price: 600, updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/services');

    await page.getByTestId('service-edit').click();
    await page.getByTestId('service-duration').fill('40');
    await page.getByTestId('service-price').fill('600');
    await expect(page.getByTestId('service-copies-warning')).toHaveCount(0);

    await page.getByTestId('service-reason').fill('Master asked by phone');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('service-row-price')).toContainText('600');
    expect(mock.bodies[`PATCH ${SERVICES_PATH}/svc1`]).toEqual([
      {
        updatedAt: '2026-06-01T00:00:00.000Z',
        durationMinutes: 40,
        price: 600,
        reason: 'Master asked by phone',
      },
    ]);
  });

  test('deactivates a service and brings it back — it is never deleted', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...catalogRoutes([service()]),
      [`DELETE ${SERVICES_PATH}/svc1`]: apiOk(service({ isActive: false, updatedAt: '2026-09-21T10:00:00.000Z' })),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiOk(service({ updatedAt: '2026-09-21T10:05:00.000Z' })),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/services');

    await page.getByTestId('service-deactivate').click();
    await expect(page.getByTestId('service-row-active')).toHaveText('Деактивована');

    await page.getByTestId('service-activate').click();
    await expect(page.getByTestId('service-row-active')).toHaveText('Активна');
    expect(mock.bodies[`PATCH ${SERVICES_PATH}/svc1`]).toEqual([
      { updatedAt: '2026-09-21T10:00:00.000Z', isActive: true },
    ]);
  });

  test('offers to reload when the Майстер edited the service meanwhile', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      ...catalogRoutes([service()]),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiError(409, 'EDIT_CONFLICT'),
      [`GET ${SERVICES_PATH}/svc1`]: apiOk(service({ name: 'Haircut deluxe', updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/services');

    await page.getByTestId('service-edit').click();
    await page.getByTestId('service-price').fill('600');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();
    await expect(page.getByTestId('service-name')).toHaveValue('Haircut deluxe');
  });

  test('is read-only for a Видалений майстер', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, catalogRoutes([service()], { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }));
    await signIn(page, ADMIN, '/independent-masters/m1/services');

    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-new')).toHaveCount(0);
    await expect(page.getByTestId('service-edit')).toHaveCount(0);
    await expect(page.getByTestId('service-deactivate')).toHaveCount(0);
  });
});

test.describe('independent master working schedule', () => {
  test('shows his week alone — no Години роботи Салону bound it', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, scheduleRoutes());
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('07:00 – 20:00');
    // Saturday: a day no Салон week would have allowed him.
    await expect(weekRow(page, 5).getByTestId('schedule-day-master')).toContainText('10:00 – 16:00');
    await expect(weekRow(page, 6).getByTestId('schedule-day-master')).toContainText('Не працює');

    // The Салон column, the «sticks out» flag and the read that would fetch the bounds are absent.
    await expect(page.getByTestId('schedule-day-salon')).toHaveCount(0);
    await expect(page.getByTestId('schedule-day-outside')).toHaveCount(0);
  });

  test('sends the whole week with the reason, and the calendar follows the saved week', async ({
    page,
    mockBackend,
  }) => {
    const saved = [closed(0), open(1, '08:00', '19:00'), open(2), open(3), open(4), open(5), open(6, '10:00', '16:00')];
    const mock = await mockBackend(ADMIN, scheduleRoutes({ [PUT_HOURS]: apiOk({ days: saved }) }));
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await page.getByTestId('hours-edit').click();
    // Nothing above him: no day shows bounds, and none can stick out of them.
    await expect(page.getByTestId('hours-bounds')).toHaveCount(0);
    await expect(page.getByTestId('hours-outside')).toHaveCount(0);

    await editRow(page, 0).getByTestId('hours-start').fill('08:00');
    await editRow(page, 0).getByTestId('hours-end').fill('19:00');
    await page.getByTestId('hours-reason').fill('Master asked by phone');
    await page.getByTestId('hours-save').click();

    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('08:00 – 19:00');
    expect(mock.bodies[PUT_HOURS]).toEqual([{ masterHours: saved, reason: 'Master asked by phone' }]);
  });

  test('saves over the Записи his new week leaves standing only the week they were named for', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(
      ADMIN,
      scheduleRoutes({
        [PUT_HOURS]: (_url: URL, body: unknown) => {
          const { masterHours, allowExistingAppointments } = body as {
            masterHours: unknown[];
            allowExistingAppointments?: boolean;
          };
          return allowExistingAppointments
            ? apiOk({ days: masterHours })
            : apiError(409, 'SCHEDULE_CHANGE_HAS_APPOINTMENTS', 'Booked appointments no longer fit', {
                dates: ['2026-10-12'],
                appointmentCount: 1,
                appointments: [],
              });
        },
      }),
    );
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await page.getByTestId('hours-edit').click();
    await editRow(page, 0).getByTestId('hours-end').fill('14:00');
    await page.getByTestId('hours-save').click();
    await expect(page.getByTestId('hours-conflict')).toContainText('поза робочим часом: 1');

    // The Записи were named for the week sent: another week has to be sent, and refused, first.
    await editRow(page, 0).getByTestId('hours-end').fill('15:00');
    await expect(page.getByTestId('hours-conflict')).toHaveCount(0);
    await page.getByTestId('hours-save').click();
    await page.getByTestId('hours-confirm').click();

    await expect(page.getByTestId('hours-form')).toHaveCount(0);
    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('07:00 – 15:00');
    const week = (end: string) => [
      closed(0),
      open(1, '07:00', end),
      open(2),
      open(3),
      open(4),
      open(5),
      open(6, '10:00', '16:00'),
    ];
    expect(mock.bodies[PUT_HOURS]).toEqual([
      { masterHours: week('14:00') },
      { masterHours: week('15:00') },
      { masterHours: week('15:00'), allowExistingAppointments: true },
    ]);
  });

  test('draws the month a Клієнт would meet: working days, Відсутності and Записи', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, scheduleRoutes());
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await expect(page.getByTestId('calendar-day').first()).toBeVisible();
    await expect(page.getByTestId('time-off-row')).toHaveCount(1);
    await expect(page.getByTestId('time-off-row').getByTestId('time-off-type')).toHaveText('Вихідний');
  });

  test('sets and clears the Ротація on his own calendar', async ({ page, mockBackend }) => {
    const PATTERN = 'PUT /admin/masters/m1/schedule-pattern';
    const mock = await mockBackend(
      ADMIN,
      scheduleRoutes({
        [PATTERN]: (_url: URL, body: unknown) => apiOk({ schedulePattern: (body as { pattern: unknown }).pattern }),
      }),
    );
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await expect(page.getByTestId('rotation-summary')).toContainText('Ротації немає');
    await page.getByTestId('rotation-edit').click();

    await page.getByTestId('rotation-length').fill('3');
    await rotationDay(page, 2).uncheck();
    await page.getByTestId('rotation-reason').fill('Master asked by phone');
    await page.getByTestId('rotation-save').click();

    await expect(page.getByTestId('rotation-form')).toHaveCount(0);
    await expect(page.getByTestId('rotation-summary')).toContainText('Цикл 3 дн.');
    expect(mock.bodies[PATTERN]).toEqual([
      {
        pattern: {
          patternType: 'CYCLE',
          anchorDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          cycleLength: 3,
          workingOffsets: [0, 1],
        },
        reason: 'Master asked by phone',
      },
    ]);
  });

  test('files a Відсутність no Салон week could refuse', async ({ page, mockBackend }) => {
    const CREATE = 'POST /admin/masters/m1/time-off';
    const mock = await mockBackend(
      ADMIN,
      scheduleRoutes({
        [CREATE]: (_url: URL, body: unknown) => ({
          status: 201,
          body: apiOk({
            groupId: 'g9',
            createdAt: '2026-09-21T10:00:00.000Z',
            slots: [],
            ...((body as { timeOff: Record<string, unknown> }).timeOff ?? {}),
          }).body,
        }),
      }),
    );
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await page.getByTestId('time-off-add').click();
    // Особливі години starting before any Салон opens: nothing bounds them here.
    await page.getByTestId('time-off-type-CUSTOM_HOURS').check();
    await page.getByTestId('time-off-from').fill('2027-03-01');
    await page.getByTestId('time-off-to').fill('2027-03-01');
    await page.getByTestId('time-off-start').fill('07:00');
    await page.getByTestId('time-off-end').fill('11:00');
    await page.getByTestId('time-off-save').click();

    await expect(page.getByTestId('time-off-form')).toHaveCount(0);
    expect(mock.bodies[CREATE]).toEqual([
      {
        timeOff: {
          type: 'CUSTOM_HOURS',
          fromDate: '2027-03-01',
          toDate: '2027-03-01',
          slots: [{ start: '07:00', end: '11:00' }],
        },
      },
    ]);
  });

  test('offers no editing for a Видалений майстер', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, scheduleRoutes({}, { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }));
    await signIn(page, ADMIN, '/independent-masters/m1/schedule');

    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);
    await expect(page.getByTestId('rotation-edit')).toHaveCount(0);
    await expect(page.getByTestId('time-off-add')).toHaveCount(0);
  });
});
