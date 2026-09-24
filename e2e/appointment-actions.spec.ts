import { apiError, apiOk, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * Дії над Записом from the card the Запис is read on: скасування with a mandatory reason, closing
 * a visit that happened, and перенесення onto an hour the backend has called free.
 *
 * What these specs are about: the dialog will not confirm a cancellation without a reason, the
 * body that goes out is exactly the action asked for, a refusal leaves the dialog standing with
 * everything as typed, and the row redraws from the answer rather than from hope. The browser sits
 * far from the venue, so every hour on screen has to be the venue's.
 */

test.use({ timezoneId: 'America/Los_Angeles' });

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SALON_LIST = 'GET /admin/salons/s1/appointments';
const DETAILS = 'GET /admin/appointments/a1';
const STATUS = 'PATCH /admin/appointments/a1';
const RESCHEDULE = 'PATCH /admin/appointments/a1/reschedule';
const SLOTS = 'GET /admin/appointments/a1/available-slots';

/** Two days ahead, so «у минулому» never decides a spec and the day is stable while it runs. */
const DAY = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
/** 09:00 in Chișinău (UTC+3) — and the previous evening where the browser sits. */
const START = `${DAY}T06:00:00Z`;
const END = `${DAY}T06:45:00Z`;

const salon = {
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
  bufferMinutes: 0,
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
};

const rosterMaster = {
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

const appointment = (overrides: Record<string, unknown> = {}) => ({
  appointmentId: 'a1',
  startTime: START,
  endTime: END,
  status: 'BOOKED',
  clientName: 'Maria Client',
  masterId: 'm2',
  masterName: 'Ion Popa',
  salonId: 's1',
  serviceNames: ['Стрижка'],
  totalPrice: 350,
  currency: 'MDL',
  isManual: false,
  ...overrides,
});

/** The clock the card shows — every action has to send exactly this back. */
const SEEN = '2026-09-20T10:00:00.000Z';

const details = (overrides: Record<string, unknown> = {}) => ({
  ...appointment(),
  updatedAt: SEEN,
  timezone: 'Europe/Chisinau',
  clientId: 'c1',
  clientPhone: '+37360000001',
  salonName: 'Beauty Lab',
  venueStatus: 'active',
  services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
  totalDurationMinutes: 45,
  notes: null,
  ...overrides,
});

const listOf = (items: unknown[]): MockResponse => apiOk({ timezone: 'Europe/Chisinau', items });

/** A day of the Майстер's calendar: three offers, one of them already taken. */
const slotsPage = apiOk({
  timezone: 'Europe/Chisinau',
  slotOptions: [
    { date: DAY, localTime: '09:00', startAtUtc: START, utcOffset: '+03:00', status: 'available' },
    {
      date: DAY,
      localTime: '11:00',
      startAtUtc: `${DAY}T08:00:00Z`,
      utcOffset: '+03:00',
      status: 'booked',
    },
    {
      date: DAY,
      localTime: '14:00',
      startAtUtc: `${DAY}T11:00:00Z`,
      utcOffset: '+03:00',
      status: 'available',
    },
  ],
});

const routes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon),
  'GET /admin/salons/s1/masters': apiOk({ items: [rosterMaster] }),
  [SALON_LIST]: listOf([appointment()]),
  [DETAILS]: apiOk(details()),
  ...extra,
});

/** Opens the Салон's tab and expands the one Запис on it. */
async function openTheAppointment(page: import('@playwright/test').Page): Promise<void> {
  await signIn(page, ADMIN, '/salons/s1/appointments');
  await page.getByTestId('appointment-row').first().click();
  await expect(page.getByTestId('appointment-actions')).toBeVisible();
}

test.describe('cancelling a Запис', () => {
  test('will not confirm without a reason, then sends the one that was typed', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(
      ADMIN,
      routes({ [STATUS]: apiOk(details({ status: 'CANCELLED' })) }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-CANCELLED').click();

    // The heavy action is owed an explanation: nothing goes out until there is one.
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await page.getByTestId('reason-input').fill('Салон не відповідає');
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    expect(mock.bodies[STATUS]).toEqual([
      { status: 'CANCELLED', updatedAt: SEEN, reason: 'Салон не відповідає' },
    ]);
  });

  test('redraws the row from the answer, and stops offering actions over a closed Запис', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, routes({ [STATUS]: apiOk(details({ status: 'CANCELLED' })) }));

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-CANCELLED').click();
    await page.getByTestId('reason-input').fill('Салон не відповідає');
    await page.getByTestId('reason-confirm').click();

    // The list is not re-read: the row it already shows is the one the answer describes.
    await expect(page.getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(page.getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(page.getByTestId('appointment-actions')).toHaveCount(0);
    await expect(page.getByTestId('appointment-actions-closed')).toBeVisible();
  });

  test('keeps the dialog and the typed reason when the backend refuses', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({ [STATUS]: apiError(409, 'APPOINTMENT_ALREADY_CANCELLED') }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-CANCELLED').click();
    await page.getByTestId('reason-input').fill('Салон не відповідає');
    await page.getByTestId('reason-confirm').click();

    // The code is worded, not shown raw, and nothing about the Запис is claimed to have changed.
    await expect(page.getByText('Запис уже скасовано. Оновіть сторінку.')).toBeVisible();
    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Салон не відповідає');
    await expect(page.getByTestId('appointment-row-status')).toHaveText('Заброньовано');
  });
});

test.describe('closing a visit that happened', () => {
  test('asks first, but takes no reason — and sends none', async ({ page, mockBackend }) => {
    const mock = await mockBackend(
      ADMIN,
      routes({ [STATUS]: apiOk(details({ status: 'COMPLETED' })) }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-COMPLETED').click();

    // Not owed an explanation, so the confirmation stands ready with the field blank.
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-confirm').click();

    expect(mock.bodies[STATUS]).toEqual([{ status: 'COMPLETED', updatedAt: SEEN }]);
    await expect(page.getByTestId('appointment-row-status')).toHaveText('Завершено');
  });

  test('offers «не з’явився» the same way', async ({ page, mockBackend }) => {
    const mock = await mockBackend(
      ADMIN,
      routes({ [STATUS]: apiOk(details({ status: 'NO_SHOW' })) }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-NO_SHOW').click();
    await page.getByTestId('reason-confirm').click();

    expect(mock.bodies[STATUS]).toEqual([{ status: 'NO_SHOW', updatedAt: SEEN }]);
    await expect(page.getByTestId('appointment-row-status')).toHaveText('Не з’явився');
  });
});

test.describe('moving a Запис', () => {
  test('opens on the Запис’s own day, offers only free hours and sends the picked one', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    const mock = await mockBackend(
      ADMIN,
      routes({
        [SLOTS]: (url) => {
          asked.push(url.searchParams);
          return slotsPage;
        },
        [RESCHEDULE]: apiOk(details({ startTime: `${DAY}T11:00:00Z`, endTime: `${DAY}T11:45:00Z` })),
      }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-reschedule').click();

    // The dialog opens on the day the Запис is on — on the venue's clock, not the browser's.
    await expect(page.getByTestId('reschedule-day')).toHaveValue(DAY);
    expect(asked.map((params) => params.get('date'))).toEqual([DAY]);
    await expect(page.getByTestId('reschedule-current')).toContainText('09:00');

    const slots = page.getByTestId('reschedule-slot');
    await expect(slots).toHaveCount(3);
    // A taken hour is shown rather than hidden — "why can I not pick 11:00" is the question the
    // dialog exists to answer — but it cannot be chosen.
    await expect(slots.filter({ hasText: '11:00' })).toBeDisabled();
    await expect(page.getByTestId('reschedule-confirm')).toBeDisabled();

    await slots.filter({ hasText: '14:00' }).click();
    await page.getByTestId('reschedule-reason').fill('Сторони домовились');
    await page.getByTestId('reschedule-confirm').click();

    expect(mock.bodies[RESCHEDULE]).toEqual([
      { startDateTime: `${DAY}T11:00:00Z`, updatedAt: SEEN, reason: 'Сторони домовились' },
    ]);
    await expect(page.getByTestId('reschedule-dialog')).toHaveCount(0);
    await expect(page.getByTestId('appointment-row-when')).toContainText('14:00');
  });

  test('re-asks for another day and sends no reason when none was typed', async ({
    page,
    mockBackend,
  }) => {
    const nextDay = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const asked: string[] = [];
    const mock = await mockBackend(
      ADMIN,
      routes({
        [SLOTS]: (url) => {
          asked.push(url.searchParams.get('date') ?? '');
          return slotsPage;
        },
        [RESCHEDULE]: apiOk(details({ startTime: `${DAY}T11:00:00Z`, endTime: `${DAY}T11:45:00Z` })),
      }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-reschedule').click();
    await page.getByTestId('reschedule-day').fill(nextDay);

    await expect.poll(() => asked).toEqual([DAY, nextDay]);
    // A new day starts the choice over: nothing picked from the last one can be confirmed.
    await expect(page.getByTestId('reschedule-confirm')).toBeDisabled();

    await page.getByTestId('reschedule-slot').filter({ hasText: '14:00' }).click();
    await page.getByTestId('reschedule-confirm').click();

    expect(mock.bodies[RESCHEDULE]).toEqual([{ startDateTime: `${DAY}T11:00:00Z`, updatedAt: SEEN }]);
  });

  test('says so in the dialog when the day offers nothing', async ({ page, mockBackend }) => {
    await mockBackend(
      ADMIN,
      routes({
        [SLOTS]: apiOk({ timezone: 'Europe/Chisinau', slotOptions: [] }),
      }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-reschedule').click();

    await expect(page.getByTestId('reschedule-no-slots')).toBeVisible();
    await expect(page.getByTestId('reschedule-confirm')).toBeDisabled();
  });

  test('keeps the dialog standing when the slot is taken between the grid and the write', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({ [SLOTS]: slotsPage, [RESCHEDULE]: apiError(409, 'SLOT_UNAVAILABLE') }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-reschedule').click();
    await page.getByTestId('reschedule-slot').filter({ hasText: '14:00' }).click();
    await page.getByTestId('reschedule-confirm').click();

    await expect(page.getByText('Цей слот уже зайнятий. Оберіть інший.')).toBeVisible();
    await expect(page.getByTestId('reschedule-dialog')).toBeVisible();
    await expect(page.getByTestId('appointment-row-when')).toContainText('09:00');
  });
});

test.describe('a card that has gone stale', () => {
  test('is refused rather than overwriting, and says to reload', async ({ page, mockBackend }) => {
    const mock = await mockBackend(
      ADMIN,
      routes({ [STATUS]: apiError(409, 'EDIT_CONFLICT') }),
    );

    await openTheAppointment(page);
    await page.getByTestId('appointment-action-CANCELLED').click();
    await page.getByTestId('reason-input').fill('Салон не відповідає');
    await page.getByTestId('reason-confirm').click();

    // The clock the card was drawn from travels with the action — that is what the backend
    // compares against, and what makes the refusal possible at all.
    expect(mock.bodies[STATUS]).toEqual([
      { status: 'CANCELLED', updatedAt: SEEN, reason: 'Салон не відповідає' },
    ]);
    await expect(page.getByText('Дані змінились. Перезавантажте форму й спробуйте ще раз.')).toBeVisible();
    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('appointment-row-status')).toHaveText('Заброньовано');
  });
});

test.describe('a Запис nobody may act on', () => {
  test('offers nothing over one that is already closed', async ({ page, mockBackend }) => {
    await mockBackend(
      ADMIN,
      routes({
        [SALON_LIST]: listOf([appointment({ status: 'COMPLETED' })]),
        [DETAILS]: apiOk(details({ status: 'COMPLETED' })),
      }),
    );

    await signIn(page, ADMIN, '/salons/s1/appointments');
    await page.getByTestId('appointment-row').first().click();

    await expect(page.getByTestId('appointment-actions-closed')).toBeVisible();
    await expect(page.getByTestId('appointment-action-CANCELLED')).toHaveCount(0);
    await expect(page.getByTestId('appointment-action-reschedule')).toHaveCount(0);
  });
});
