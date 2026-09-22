import { apiOk, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * The Записи tab of a Салон, of a Майстер салону and of a Незалежний майстер — one table on three
 * cards. What these specs are about: the window always travels with the request, the rows are
 * printed on the venue's clock, a Запис whose time passed while still «заброньовано» stands out,
 * a row opens into the whole Запис, and nothing here creates one.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SALON_LIST = 'GET /admin/salons/s1/appointments';
const MASTER_LIST = 'GET /admin/masters/m1/appointments';
const DETAILS = 'GET /admin/appointments/a1';

/** The browser sits far from the venue: every printed hour has to be the venue's, not this one. */
test.use({ timezoneId: 'America/Los_Angeles' });

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

const independentMaster = {
  masterId: 'm1',
  name: 'Ana Rusu',
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
  phone: '+37360000009',
  email: 'ana@bookme.md',
  specialization: 'barber',
  timezone: 'Europe/Chisinau',
  rating: 4.6,
  reviewCount: 7,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  salon: null,
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
  // 09:00 in Chișinău (UTC+3) — and the day before in the browser's own zone.
  startTime: '2026-09-21T06:00:00Z',
  endTime: '2026-09-21T06:45:00Z',
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

const details = (overrides: Record<string, unknown> = {}) => ({
  ...appointment(),
  timezone: 'Europe/Chisinau',
  clientId: 'c1',
  clientPhone: '+37360000001',
  salonName: 'Beauty Lab',
  services: [
    { serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 },
    { serviceId: 'svc2', name: 'Укладка', durationMinutes: 30, price: 200 },
  ],
  totalDurationMinutes: 75,
  totalPrice: 550,
  notes: 'Клієнтка просила не запізнюватись',
  ...overrides,
});

/** The Записи the list answers with, whatever window or filter was asked for. */
const listOf = (items: unknown[]): MockResponse => apiOk({ timezone: 'Europe/Chisinau', items });

const salonRoutes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon()),
  'GET /admin/salons/s1/masters': apiOk({ items: [rosterMaster] }),
  [SALON_LIST]: listOf([appointment()]),
  ...extra,
});

test.describe('appointments in a salon card', () => {
  test('asks for a window, prints the rows on the salon’s clock and opens one in full', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf([appointment(), appointment({ appointmentId: 'a2', isManual: true, status: 'COMPLETED' })]);
        },
        [DETAILS]: apiOk(details()),
      }),
    );

    await signIn(page, ADMIN, '/salons/s1/appointments');

    const rows = page.getByTestId('appointment-row');
    await expect(rows).toHaveCount(2);
    // Both bounds always travel: the backend refuses a list without them.
    expect(asked).toHaveLength(1);
    expect(asked[0].get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(asked[0].get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(asked[0].has('status')).toBe(false);

    // 06:00Z is 09:00 in Chișinău — and 23:00 of the previous day where the browser sits.
    await expect(rows.nth(0).getByTestId('appointment-row-when')).toContainText('09:00');
    await expect(rows.nth(0).getByTestId('appointment-row-client')).toHaveText('Maria Client');
    await expect(rows.nth(0).getByTestId('appointment-row-master')).toHaveText('Ion Popa');
    await expect(rows.nth(0).getByTestId('appointment-row-services')).toContainText('Стрижка');
    await expect(rows.nth(0).getByTestId('appointment-row-price')).toContainText('350');
    await expect(rows.nth(0).getByTestId('appointment-row-status')).toHaveText('Заброньовано');
    await expect(rows.nth(1).getByTestId('appointment-row-manual')).toBeVisible();

    await rows.nth(0).click();

    const opened = page.getByTestId('appointment-details');
    await expect(opened.getByTestId('appointment-details-client')).toHaveText('Maria Client');
    await expect(opened.getByTestId('appointment-details-phone')).toHaveText('+37360000001');
    await expect(opened.getByTestId('appointment-details-master')).toHaveText('Ion Popa');
    await expect(opened.getByTestId('appointment-details-salon')).toHaveText('Beauty Lab');
    await expect(opened.getByTestId('appointment-details-service')).toHaveCount(2);
    await expect(opened.getByTestId('appointment-details-total')).toContainText('550');
    await expect(opened.getByTestId('appointment-details-notes')).toHaveText('Клієнтка просила не запізнюватись');
    await expect(opened.getByTestId('appointment-details-when')).toContainText('09:00');
  });

  test('marks a past Запис that is still «заброньовано», and leaves a closed one alone', async ({
    page,
    mockBackend,
  }) => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: listOf([
          appointment({ appointmentId: 'past-booked', startTime: past, endTime: past }),
          appointment({ appointmentId: 'past-done', startTime: past, endTime: past, status: 'COMPLETED' }),
          appointment({ appointmentId: 'ahead', startTime: future, endTime: future }),
        ]),
      }),
    );

    await signIn(page, ADMIN, '/salons/s1/appointments');

    const rows = page.getByTestId('appointment-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).getByTestId('appointment-row-stale')).toBeVisible();
    await expect(rows.nth(1).getByTestId('appointment-row-stale')).toHaveCount(0);
    await expect(rows.nth(2).getByTestId('appointment-row-stale')).toHaveCount(0);
  });

  test('sends the filters to the backend and keeps them in the address', async ({ page, mockBackend }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf(url.searchParams.has('status') ? [] : [appointment()]);
        },
      }),
    );
    await signIn(page, ADMIN, '/salons/s1/appointments');
    await expect(page.getByTestId('appointment-row')).toHaveCount(1);

    await page.getByTestId('appointments-filter-from').fill('2026-09-01');
    await page.getByTestId('appointments-filter-to').fill('2026-09-30');
    await page.getByTestId('appointments-filter-status').click();
    await page.getByRole('option', { name: 'Скасовано' }).click();

    await expect(page.getByTestId('appointments-empty')).toBeVisible();
    await expect(page).toHaveURL(/from=2026-09-01/);
    await expect(page).toHaveURL(/to=2026-09-30/);
    await expect(page).toHaveURL(/status=CANCELLED/);

    await page.getByTestId('appointments-filter-master').click();
    await page.getByRole('option', { name: 'Ion Popa' }).click();

    await expect(page).toHaveURL(/masterId=m2/);
    const last = asked[asked.length - 1];
    expect([last.get('from'), last.get('to'), last.get('status'), last.get('masterId')]).toEqual([
      '2026-09-01',
      '2026-09-30',
      'CANCELLED',
      'm2',
    ]);
  });

  test('writes the window it is showing into the address, trimming one too wide to answer', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf([appointment()]);
        },
      }),
    );

    // A whole year: wider than the backend answers, so the tab trims it — and says so in the
    // address, which is what a copied link has to reopen.
    await signIn(page, ADMIN, '/salons/s1/appointments?from=2026-01-01&to=2026-12-31');

    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    await expect(page).toHaveURL(/from=2026-01-01/);
    await expect(page).toHaveURL(/to=2026-04-02/);
    expect(asked).toHaveLength(1);
    expect([asked[0].get('from'), asked[0].get('to')]).toEqual(['2026-01-01', '2026-04-02']);
    await expect(page.getByTestId('appointments-filter-to')).toHaveValue('2026-04-02');
  });

  test('says there is no way to create a Запис from the panel', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, salonRoutes({ [SALON_LIST]: listOf([]) }));

    await signIn(page, ADMIN, '/salons/s1/appointments');

    await expect(page.getByTestId('appointments-empty')).toBeVisible();
    await expect(page.getByTestId('appointments-readonly')).toContainText('створити Запис неможливо');
    await expect(page.getByRole('button', { name: /Створити|Додати/ })).toHaveCount(0);
  });
});

test.describe('appointments in a master card', () => {
  test('a Майстер салону reads his Салон’s list, pinned to him', async ({ page, mockBackend }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      ...salonRoutes({
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf([appointment()]);
        },
      }),
      'GET /admin/salons/s1/masters/m2': apiOk(rosterMaster),
    });

    await signIn(page, ADMIN, '/salons/s1/masters/m2/appointments');

    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    expect(asked[0].get('masterId')).toBe('m2');
    // His own list needs neither the filter nor a column repeating his name.
    await expect(page.getByTestId('appointments-filter-master')).toHaveCount(0);
    await expect(page.getByTestId('appointment-row-master')).toHaveCount(0);
  });

  test('a Незалежний майстер reads his own Записи, with no Салон behind them', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(independentMaster),
      [MASTER_LIST]: listOf([appointment({ masterId: 'm1', masterName: 'Ana Rusu', salonId: null })]),
      [DETAILS]: apiOk(details({ masterId: 'm1', masterName: 'Ana Rusu', salonId: null, salonName: null })),
    });

    await signIn(page, ADMIN, '/independent-masters/m1/appointments');

    const rows = page.getByTestId('appointment-row');
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('appointments-filter-master')).toHaveCount(0);

    await rows.nth(0).click();

    await expect(page.getByTestId('appointment-details-salon')).toHaveText('Незалежний майстер');
  });
});
