import type { Page } from '@playwright/test';
import { apiError, apiOk, type MockResponse } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SCHEDULE = 'GET /admin/salons/s1/masters/m2/schedule';
const PUT = 'PUT /admin/salons/s1/masters/m2/hours';
const TAB = '/salons/s1/masters/m2/schedule';

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: '',
  addressStreet: '',
  addressHouseNumber: '',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: '',
  addressCountry: 'Moldova',
  locationLatitude: null,
  locationLongitude: null,
  phone: '',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 4.8,
  reviewCount: 12,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const MASTER = {
  masterId: 'm2',
  isOwner: false,
  masterName: 'Ion Popa',
  masterAvatar: '',
  email: 'ion@bookme.md',
  specialization: 'barber',
  status: 'ACTIVE',
  commissionPercent: 40,
  bookingForwardDays: 14,
  rating: 4.6,
  reviewCount: 7,
  joinedAt: '2026-02-01T23:30:00.000Z',
  updatedAt: null,
};

const open = (dayOfWeek: number, start = '09:00', end = '18:00') => ({
  dayOfWeek,
  isOpen: true,
  slots: [{ start, end }],
});
const closed = (dayOfWeek: number) => ({ dayOfWeek, isOpen: false, slots: [] });

/** The Салон works Mon–Fri 09–18. */
const SALON_HOURS = { days: [closed(0), open(1), open(2), open(3), open(4), open(5), closed(6)] };
/** The Майстер: Mon–Fri inside the Салон, and a Saturday the Салон is closed on. */
const MASTER_WEEK = [
  closed(0),
  open(1, '10:00', '17:00'),
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
      {
        groupId: 'g2',
        type: 'CUSTOM_HOURS',
        fromDate: addDays(from, 10),
        toDate: addDays(from, 10),
        slots: [{ start: '12:00', end: '15:00' }],
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
      {
        appointmentId: 'a2',
        startTime: `${addDays(from, 7)}T10:00:00Z`,
        endTime: `${addDays(from, 7)}T11:00:00Z`,
        status: 'COMPLETED',
      },
      {
        appointmentId: 'a3',
        startTime: `${addDays(from, 7)}T12:00:00Z`,
        endTime: `${addDays(from, 7)}T13:00:00Z`,
        status: 'CANCELLED',
      },
      // 23:30 UTC is already the next day in Chișinău.
      {
        appointmentId: 'a4',
        startTime: `${addDays(from, 10)}T23:30:00Z`,
        endTime: `${addDays(from, 11)}T00:30:00Z`,
        status: 'BOOKED',
      },
    ],
    todayDate: addDays(from, 7),
    timezone: 'Europe/Chisinau',
  });
};

const routes = (
  extra: Record<string, MockResponse | ((url: URL, body: unknown) => MockResponse)> = {},
  salonOverrides = {},
) => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon(salonOverrides)),
  'GET /admin/salons/s1/masters/m2': apiOk(MASTER),
  'GET /admin/salons/s1/hours': apiOk(SALON_HOURS),
  [SCHEDULE]: (url: URL) => schedule(url),
  ...extra,
});

/** Rows are Monday first: row 0 is Monday, row 6 Sunday. */
const weekRow = (page: Page, index: number) => page.getByTestId('schedule-day').nth(index);
const editRow = (page: Page, index: number) => page.getByTestId('hours-edit-day').nth(index);
/** The grid starts on a Monday; cell 7 is the Monday of its second week. */
const cell = (page: Page, index: number) => page.getByTestId('calendar-day').nth(index);

test.describe('salon master working schedule', () => {
  test('shows the master’s week next to the Години роботи of his salon and flags what sticks out', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, routes());
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('10:00 – 17:00');
    await expect(weekRow(page, 0).getByTestId('schedule-day-salon')).toContainText('09:00 – 18:00');
    await expect(weekRow(page, 0).getByTestId('schedule-day-outside')).toHaveCount(0);
    // Saturday: the master works, the salon does not.
    await expect(weekRow(page, 5).getByTestId('schedule-day-master')).toContainText('10:00 – 16:00');
    await expect(weekRow(page, 5).getByTestId('schedule-day-salon')).toContainText('Зачинено');
    await expect(weekRow(page, 5).getByTestId('schedule-day-outside')).toBeVisible();
    await expect(weekRow(page, 6).getByTestId('schedule-day-master')).toContainText('Не працює');
  });

  test('sends the whole week with the reason, and the calendar follows the saved week', async ({
    page,
    mockBackend,
  }) => {
    const saved = [closed(0), open(1, '11:00', '17:00'), open(2), open(3), open(4), open(5), closed(6)];
    const mock = await mockBackend(ADMIN, routes({ [PUT]: apiOk({ days: saved }) }));
    await signIn(page, ADMIN, TAB);

    await expect(cell(page, 7).getByTestId('calendar-day-hours')).toHaveText('10:00 – 17:00');
    await page.getByTestId('hours-edit').click();
    // The editor shows what each day has to fit in.
    await expect(editRow(page, 0).getByTestId('hours-bounds')).toContainText('09:00 – 18:00');
    await expect(editRow(page, 5).getByTestId('hours-bounds')).toContainText('Зачинено');
    await expect(editRow(page, 5).getByTestId('hours-outside')).toBeVisible();
    await expect(page.getByTestId('hours-save')).toBeDisabled();

    await editRow(page, 0).getByTestId('hours-start').fill('11:00');
    await editRow(page, 5).getByTestId('hours-open').uncheck();
    await expect(editRow(page, 5).getByTestId('hours-outside')).toHaveCount(0);
    await page.getByTestId('hours-reason').fill('Master asked by phone');
    await page.getByTestId('hours-save').click();

    await expect(page.getByTestId('hours-form')).toHaveCount(0);
    expect(mock.bodies[PUT]).toEqual([{ masterHours: saved, reason: 'Master asked by phone' }]);
    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('11:00 – 17:00');
    await expect(weekRow(page, 5).getByTestId('schedule-day-outside')).toHaveCount(0);
    await expect(cell(page, 7).getByTestId('calendar-day-hours')).toHaveText('11:00 – 17:00');
  });

  test('words the domain’s refusal of hours outside the Години роботи, and keeps the form as typed', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({
        [PUT]: apiError(400, 'MASTER_HOURS_OUTSIDE_SALON_HOURS', 'Monday 08:00-17:00 is outside the salon hours', {
          dayOfWeek: 1,
          outsideSlot: { start: '08:00', end: '17:00' },
          salonSlots: [{ start: '09:00', end: '18:00' }],
        }),
      }),
    );
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('hours-edit').click();
    await editRow(page, 0).getByTestId('hours-start').fill('08:00');
    await expect(editRow(page, 0).getByTestId('hours-outside')).toBeVisible();
    await page.getByTestId('hours-save').click();

    await expect(page.getByTestId('hours-refusal')).toHaveText(
      'Понеділок: 08:00 – 17:00 виходить за Години роботи Салону (09:00 – 18:00).',
    );
    await expect(editRow(page, 0).getByTestId('hours-start')).toHaveValue('08:00');

    // The same refusal in another language.
    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();
    await expect(page.getByTestId('hours-refusal')).toContainText('iese din Programul de lucru al Salonului');
  });

  test('words a salon closed that day', async ({ page, mockBackend }) => {
    await mockBackend(
      ADMIN,
      routes({
        [PUT]: apiError(400, 'MASTER_HOURS_OUTSIDE_SALON_HOURS', 'The salon is closed on Sunday', {
          dayOfWeek: 0,
          outsideSlot: null,
          salonSlots: [],
        }),
      }),
    );
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('hours-edit').click();
    await editRow(page, 6).getByTestId('hours-open').check();
    await page.getByTestId('hours-save').click();

    await expect(page.getByTestId('hours-refusal')).toHaveText('Неділя: Салон цього дня зачинений.');
  });

  test('names the Записи the new week leaves standing and saves it over them only once confirmed', async ({
    page,
    mockBackend,
  }) => {
    const saved = [
      closed(0),
      open(1, '10:00', '14:00'),
      open(2),
      open(3),
      open(4),
      open(5),
      open(6, '10:00', '16:00'),
    ];
    const mock = await mockBackend(
      ADMIN,
      routes({
        [PUT]: (_url: URL, body: unknown) =>
          (body as { allowExistingAppointments?: boolean }).allowExistingAppointments
            ? apiOk({ days: saved })
            : apiError(409, 'SCHEDULE_CHANGE_HAS_APPOINTMENTS', 'Booked appointments no longer fit', {
                dates: ['2026-10-12', '2026-10-19'],
                appointmentCount: 2,
                appointments: [],
              }),
      }),
    );
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('hours-edit').click();
    await editRow(page, 0).getByTestId('hours-end').fill('14:00');
    await page.getByTestId('hours-reason').fill('Master asked by phone');
    await page.getByTestId('hours-save').click();

    // Nothing is saved and nothing is cancelled: the week stays as typed, and the Записи are named.
    const conflict = page.getByTestId('hours-conflict');
    await expect(conflict).toContainText('поза робочим часом: 2');
    await expect(conflict).toContainText('12 жовт. 2026');
    await expect(conflict).toContainText('19 жовт. 2026');
    await expect(page.getByTestId('hours-refusal')).toHaveCount(0);
    await expect(page.locator('.p-toast-message')).toHaveCount(0);
    await expect(editRow(page, 0).getByTestId('hours-end')).toHaveValue('14:00');

    await page.getByTestId('hours-confirm').click();

    await expect(page.getByTestId('hours-form')).toHaveCount(0);
    await expect(weekRow(page, 0).getByTestId('schedule-day-master')).toContainText('10:00 – 14:00');
    await expect(page.locator('.p-toast-message')).toContainText('Тижневі години збережено.');
    expect(mock.bodies[PUT]).toEqual([
      { masterHours: saved, reason: 'Master asked by phone' },
      { masterHours: saved, reason: 'Master asked by phone', allowExistingAppointments: true },
    ]);
  });

  test('draws the month a client would meet: working days, Відсутності and Записи', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, routes());
    await signIn(page, ADMIN, TAB);

    // Monday of the second week: worked, today, two standing Записи and a cancelled one.
    await expect(cell(page, 7)).toHaveAttribute('data-status', 'OPEN');
    await expect(cell(page, 7).getByTestId('calendar-today')).toBeVisible();
    await expect(cell(page, 7).getByTestId('calendar-appointments')).toHaveText('2');
    await expect(cell(page, 7).getByTestId('calendar-cancelled')).toContainText('1');
    // Tuesday and Wednesday: a Відсутність with its reason.
    await expect(cell(page, 8)).toHaveAttribute('data-status', 'DAY_OFF');
    await expect(cell(page, 8).getByTestId('calendar-day-reason')).toHaveText('Conference');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'DAY_OFF');
    // Thursday: особливі години instead of the weekly window.
    await expect(cell(page, 10).getByTestId('calendar-day-hours')).toContainText('12:00 – 15:00');
    await expect(cell(page, 10).getByTestId('calendar-appointments')).toHaveCount(0);
    // Friday: the Запис booked late on Thursday UTC stands here, on the salon's clock.
    await expect(cell(page, 11).getByTestId('calendar-appointments')).toHaveText('1');
    // Saturday: the master works it, the salon is closed — a client finds no slot.
    await expect(cell(page, 12)).toHaveAttribute('data-status', 'BOUNDS_CLOSED');
    await expect(cell(page, 12).getByTestId('calendar-day-hours')).toHaveText('Салон зачинений');
    // Sunday: not worked.
    await expect(cell(page, 13)).toHaveAttribute('data-status', 'CLOSED');
  });

  test('reads another month when asked for one', async ({ page, mockBackend }) => {
    const windows: string[] = [];
    await mockBackend(
      ADMIN,
      routes({
        [SCHEDULE]: (url: URL) => {
          windows.push(`${url.searchParams.get('from')}..${url.searchParams.get('to')}`);
          return schedule(url);
        },
      }),
    );
    await signIn(page, ADMIN, TAB);
    await expect(page.getByTestId('calendar-day').first()).toBeVisible();
    const shown = await page.getByTestId('calendar-month').textContent();

    await page.getByTestId('calendar-next').click();

    await expect(page.getByTestId('calendar-month')).not.toHaveText(shown ?? '');
    expect(windows.length).toBe(2);
    expect(windows[1] > windows[0]).toBe(true);
    // Whole weeks, Monday to Sunday.
    const [from, to] = windows[1].split('..');
    expect(new Date(`${from}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(new Date(`${to}T00:00:00Z`).getUTCDay()).toBe(0);
  });

  test('offers no editing inside a Видалений salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, routes({}, { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }));
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);
  });
});
