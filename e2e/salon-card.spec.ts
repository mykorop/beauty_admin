import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: 'Hair and nails',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: 'Chișinău',
  addressZipCode: 'MD-2012',
  addressCountry: 'MD',
  locationLatitude: '47.0245',
  locationLongitude: '28.8323',
  phone: '+37360000001',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 4.8,
  reviewCount: 12,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: '#aa3366',
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: { kind: 'random', code: 'k7m2xq', path: '/s/k7m2xq' }, handle: null },
  // 22:30 UTC is already the next day in Chișinău (UTC+2 in January).
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const HOURS = apiOk({
  days: [
    { dayOfWeek: 0, isOpen: false, slots: [] },
    { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    {
      dayOfWeek: 2,
      isOpen: true,
      slots: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '19:00' },
      ],
    },
  ],
});

const field = (page: import('@playwright/test').Page, name: string) => page.getByTestId(`field-${name}`);

test.describe('salon card', () => {
  // Far from the salon's zone on purpose: the card must not format in the browser's.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('opens on the Profile tab with every field of the profile', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons/s1': apiOk(salon()) });

    await signIn(page, ADMIN, '/salons/s1');

    await expect(page).toHaveURL(/\/salons\/s1\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Beauty Lab');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('card-deleted-banner')).toHaveCount(0);

    await expect(field(page, 'name')).toHaveText('Beauty Lab');
    await expect(field(page, 'owner')).toHaveText('Ana Rusu');
    await expect(field(page, 'description')).toHaveText('Hair and nails');
    await expect(field(page, 'address')).toContainText('Strada Pușkin 22');
    await expect(field(page, 'address')).toContainText('Chișinău');
    await expect(field(page, 'coordinates')).toHaveText('47.0245, 28.8323');
    await expect(field(page, 'phone')).toHaveText('+37360000001');
    await expect(field(page, 'email')).toHaveText('ana@beautylab.md');
    await expect(field(page, 'timezone')).toHaveText('Europe/Chisinau');
    await expect(field(page, 'buffer')).toContainText('10');
    await expect(field(page, 'bookingHorizon')).toContainText('30');
    await expect(field(page, 'brandColor')).toContainText('#aa3366');
    await expect(field(page, 'shortLink')).toContainText('/s/k7m2xq');
  });

  test('shows dates in the salon’s time zone, not the browser’s', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons/s1': apiOk(salon()) });

    await signIn(page, ADMIN, '/salons/s1/profile');

    // 2026-01-10 22:30Z → 11 January 00:30 in Chișinău; Los Angeles would still say 10 January.
    await expect(field(page, 'createdAt')).toContainText('11 січ');
    await expect(field(page, 'createdAt')).toContainText('00:30');
  });

  test('lists every tab under its own address; unfinished ones are stubs', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons/s1': apiOk(salon()) });
    await signIn(page, ADMIN, '/salons/s1');

    await expect(page.getByTestId('card-tab')).toHaveText([
      'Профіль',
      'Години роботи',
      'Ростер',
      'Каталог послуг',
      'Записи',
      'Відгуки',
      'Фото й сертифікати',
      'Інвайти',
      'Історія',
    ]);

    await page.getByTestId('card-tab').filter({ hasText: 'Відгуки' }).click();

    await expect(page).toHaveURL(/\/salons\/s1\/reviews$/);
    await expect(page.getByTestId('card-tab-stub')).toBeVisible();
    // The card around the tab stays.
    await expect(page.getByTestId('card-title')).toHaveText('Beauty Lab');
  });

  test('shows the hours by day of week, Monday first, unset days apart from closed ones', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/hours': HOURS,
    });

    await signIn(page, ADMIN, '/salons/s1/hours');

    const days = page.getByTestId('hours-day');
    await expect(days).toHaveCount(7);
    await expect(days.nth(0)).toContainText('понеділок');
    await expect(days.nth(0)).toContainText('09:00 – 18:00');
    await expect(days.nth(1)).toContainText('09:00 – 13:00');
    await expect(days.nth(1)).toContainText('14:00 – 19:00');
    await expect(days.nth(2)).toContainText('Не задано');
    await expect(days.nth(6)).toContainText('неділя');
    await expect(days.nth(6)).toContainText('Зачинено');
  });

  test('opens a Deleted salon for reading, plainly marked', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s4': apiOk(
        salon({ salonId: 's4', name: 'Closed Doors', status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }),
      ),
      // Not active, so the card asks how many Записи are still ahead of it (§12).
      'GET /admin/salons/s4/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/salons/s4/hours': HOURS,
    });

    await signIn(page, ADMIN, '/salons/s4');

    await expect(page.getByTestId('card-status')).toHaveText('Видалений');
    await expect(page.getByTestId('card-deleted-banner')).toContainText('1 серп');
    await expect(field(page, 'name')).toHaveText('Closed Doors');

    // The mark follows the administrator across tabs.
    await page.getByTestId('card-tab').filter({ hasText: 'Години роботи' }).click();
    await expect(page.getByTestId('hours-day')).toHaveCount(7);
    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
  });

  test('shows why a Blocked salon was blocked', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/salons/s1': apiOk(
        salon({ status: 'blocked', blockedAt: '2026-07-01T08:00:00.000Z', blockedReason: 'Fraud reports' }),
      ),
    });

    await signIn(page, ADMIN, '/salons/s1');

    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('card-blocked-banner')).toContainText('Fraud reports');
  });

  test('answers an unknown salon with a translated "not found"', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/nope': apiError(404, 'NOT_FOUND', 'Salon not found'),
    });

    await signIn(page, ADMIN, '/salons/nope');

    await expect(page.getByTestId('card-not-found')).toHaveText('Салон не знайдено.');
    await expect(page.getByTestId('card-tab')).toHaveCount(0);

    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();

    await expect(page.getByTestId('card-not-found')).toHaveText('Salonul nu a fost găsit.');
  });
});
