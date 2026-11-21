import type { Page } from '@playwright/test';
import { apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
// 09:00 UTC is 11:00 in Chișinău in November.
const CHOSEN_AT = '2026-11-20T09:00:00.000Z';
const OLENA = { actorId: 'u1', actorRole: 'salon_admin', actorName: 'Olena Popa' };

/** What an `admin-api` from before Видимість answers: a card without any of its four fields. */
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
  smsNotificationsEnabled: false,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
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
  email: 'ion@bookme.md',
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
  ...overrides,
});

const rosterLink = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
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
  joinedAt: '2026-02-01T09:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

/** The Салон a Майстер's card names, with its Видимість beside its state. */
const masterSalon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  status: 'active',
  clientVisibility: 'hidden',
  pricesHidden: false,
  current: false,
  joinedAt: '2026-02-01T09:00:00.000Z',
  leftAt: '2026-07-01T12:00:00.000Z',
  ...overrides,
});

const chosen = (clientVisibility: string, pricesHidden: boolean) => ({
  clientVisibility,
  pricesHidden,
  clientVisibilityUpdatedAt: CHOSEN_AT,
  clientVisibilityUpdatedBy: OLENA,
});

const visibility = (page: Page) => page.getByTestId('client-visibility');
const prices = (page: Page) => page.getByTestId('field-pricesHidden');
const changed = (page: Page) => page.getByTestId('field-clientVisibilityLastChange');
const decidedBySalon = (page: Page) => page.getByTestId('client-visibility-decided-by-salon');

/**
 * Видимість on the Профіль tab of a card — the business's own choice, which the Адміністратор
 * платформи sees and never changes: whether clients find the profile in search, reach it only by
 * its link, or do not see it at all, and whether its prices are hidden from them.
 */
test.describe('Видимість on a Салон’s card', () => {
  for (const [state, label, hint] of [
    ['public', 'Публічний', 'Є в пошуку'],
    ['link', 'За посиланням', 'Немає в пошуку'],
    ['hidden', 'Прихований', 'не бачать профілю'],
  ] as const) {
    test(`names ${state} and what clients get of it`, async ({ page, mockBackend }) => {
      await mockBackend(ADMIN, {
        'GET /admin/me': ME,
        'GET /admin/salons/s1': apiOk(salon(chosen(state, false))),
      });
      await signIn(page, ADMIN, '/salons/s1/profile');

      await expect(visibility(page)).toHaveText(label);
      await expect(page.getByTestId('field-clientVisibility')).toContainText(hint);
      await expect(prices(page)).toHaveText('Ні');
      // The profile's state is untouched by it: Видимість is not Блокування nor deletion.
      await expect(page.getByTestId('card-status')).toHaveText('Активний');
    });
  }

  test('says the prices are hidden and who chose it when — and offers no way to change it', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(chosen('link', true))),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(prices(page)).toHaveText('Так');
    await expect(changed(page)).toContainText('Olena Popa');
    await expect(changed(page)).toContainText('11:00');
    await expect(decidedBySalon(page)).toHaveCount(0);
    for (const field of ['field-clientVisibility', 'field-pricesHidden']) {
      await expect(page.getByTestId(field).locator('input, button, [role="combobox"]')).toHaveCount(
        0,
      );
    }
  });

  test('names nobody for a Прихований nobody chose — the backfill set it', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(
        salon({
          clientVisibility: 'hidden',
          pricesHidden: false,
          clientVisibilityUpdatedAt: null,
          clientVisibilityUpdatedBy: null,
        }),
      ),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(visibility(page)).toHaveText('Прихований');
    await expect(changed(page)).toHaveCount(0);
  });

  test('shows a dash, never a guessed Публічний, when admin-api does not say', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons/s1': apiOk(salon()) });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab');
    await expect(visibility(page)).toHaveText('—');
    await expect(prices(page)).toHaveText('—');
    await expect(changed(page)).toHaveCount(0);
  });
});

test.describe('Видимість on a Незалежний майстер’s card', () => {
  test('is his own — not that of the Салон he has left', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(
        master({
          ...chosen('link', true),
          clientVisibilityUpdatedBy: { actorId: 'm1', actorRole: 'master', actorName: 'Ion Popa' },
          salon: masterSalon(),
        }),
      ),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await expect(visibility(page)).toHaveText('За посиланням');
    await expect(prices(page)).toHaveText('Так');
    await expect(changed(page)).toContainText('Ion Popa');
    await expect(changed(page)).toContainText('11:00');
    await expect(decidedBySalon(page)).toHaveCount(0);
  });

  test('shows a dash when admin-api does not say', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters/m1': apiOk(master()) });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa');
    await expect(visibility(page)).toHaveText('—');
    await expect(prices(page)).toHaveText('—');
    await expect(changed(page)).toHaveCount(0);
  });
});

test.describe('Видимість on a Майстер салону’s card', () => {
  test('is his Салон’s, and says the Салон decides it — never his own from before he joined', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // His own choice as a Незалежний майстер, kept for the day he leaves: not what clients get now.
      'GET /admin/masters/m1': apiOk(
        master({
          ...chosen('public', false),
          salon: masterSalon({ pricesHidden: true, current: true, leftAt: null }),
        }),
      ),
      'GET /admin/salons/s1': apiOk(salon(chosen('hidden', true))),
      'GET /admin/salons/s1/masters/m1': apiOk(rosterLink()),
    });
    // Opened by his own address, he is sent to his card inside the Салон.
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await expect(page).toHaveURL(/\/salons\/s1\/masters\/m1\/profile$/);
    await expect(visibility(page)).toHaveText('Прихований');
    await expect(prices(page)).toHaveText('Так');
    await expect(decidedBySalon(page)).toContainText('Визначає Салон');
    // Who chose it is the Салон card's to say.
    await expect(changed(page)).toHaveCount(0);
  });

  test('shows a dash, not Публічний, when the Салон’s card does not say', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m1': apiOk(rosterLink()),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await expect(page.getByTestId('field-commission')).toHaveText('40%');
    await expect(visibility(page)).toHaveText('—');
    await expect(prices(page)).toHaveText('—');
    await expect(decidedBySalon(page)).toBeVisible();
  });

  test('says nothing of it once the collaboration has ended', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(chosen('link', true))),
      'GET /admin/salons/s1/masters/m1': apiOk(rosterLink({ status: 'INACTIVE' })),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await expect(page.getByTestId('field-commission')).toHaveText('40%');
    await expect(page.getByTestId('field-clientVisibility')).toHaveCount(0);
    await expect(prices(page)).toHaveCount(0);
  });
});
