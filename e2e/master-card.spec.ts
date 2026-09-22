import type { Page } from '@playwright/test';
import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const PATCH = 'PATCH /admin/masters/m1';
const SEEN_UPDATED_AT = '2026-05-02T11:30:00.000Z';

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
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

const formerSalon = {
  salonId: 's1',
  name: 'Beauty Lab',
  status: 'active',
  current: false,
  joinedAt: '2026-02-01T09:00:00.000Z',
  leftAt: '2026-07-01T12:00:00.000Z',
};

const auditEntry = (overrides: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: ADMIN.email,
  targetType: 'master',
  targetId: 'm1',
  salonId: null,
  action: 'master.profile.update',
  createdAt: '2026-09-21T10:00:00.000Z',
  changes: [{ field: 'phone', before: '+37360000001', after: '+37360000002' }],
  reason: 'Master asked by phone',
  ...overrides,
});

const input = (page: Page, name: string) => page.getByTestId(`edit-${name}`);

test.describe('independent master card', () => {
  test('shows the whole profile, with every tab of the card', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters/m1': apiOk(master()) });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page).toHaveURL(/\/independent-masters\/m1\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('card-tab')).toHaveText([
      'Профіль',
      'Робочий графік',
      'Каталог послуг',
      'Записи',
      'Відгуки',
      'Фото й сертифікати',
      'Історія',
    ]);

    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa');
    await expect(page.getByTestId('field-specialization')).toHaveText('Барбер');
    await expect(page.getByTestId('field-address')).toContainText('Strada Pușkin 22');
    await expect(page.getByTestId('field-address')).toContainText('MD-2012 Chișinău');
    await expect(page.getByTestId('field-coordinates')).toHaveText('47.0245, 28.8323');
    await expect(page.getByTestId('field-email')).toHaveText('ion@bookme.md');
    await expect(page.getByTestId('field-buffer')).toContainText('10');
    await expect(page.getByTestId('field-rating')).toContainText('4,6');
    await expect(page.getByTestId('field-brandColor')).toContainText('#aa3366');
    // The card has no former salon to show, so it says nothing about one.
    await expect(page.getByTestId('card-former-salon')).toHaveCount(0);
    await expect(page.getByTestId('field-formerSalon')).toHaveCount(0);
  });

  test('a tab has its own address, and an unknown master is the card’s own screen', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      'GET /admin/masters/nope': apiError(404, 'NOT_FOUND'),
    });

    await signIn(page, ADMIN, '/independent-masters/m1/reviews');
    await expect(page.getByTestId('card-tab-stub')).toBeVisible();

    await page.goto('/independent-masters/nope');
    await expect(page.getByTestId('card-not-found')).toBeVisible();
    // A missing master is that screen, not a toast.
    await expect(page.locator('.p-toast-message')).toHaveCount(0);
  });

  test('names the Салон the master used to work at, and links to it', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master({ salon: formerSalon })),
    });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page.getByTestId('card-former-salon')).toContainText('Beauty Lab');
    await expect(page.getByTestId('field-formerSalon')).toContainText('Beauty Lab');
    await expect(page.getByTestId('field-formerSalon').getByRole('link')).toHaveAttribute('href', '/salons/s1');
  });

  test('marks a former Салон that is itself Видалений', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master({ salon: { ...formerSalon, status: 'deleted' } })),
    });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page.getByTestId('field-formerSalon')).toContainText('Видалений');
  });

  test('a Майстер салону opened by this address lands in his card inside the Ростер', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master({ salon: { ...formerSalon, current: true, leftAt: null } })),
      'GET /admin/salons/s1': apiOk({
        salonId: 's1',
        name: 'Beauty Lab',
        status: 'active',
        timezone: 'Europe/Chisinau',
        shortLinks: { random: null, handle: null },
      }),
      'GET /admin/salons/s1/masters/m1': apiOk({
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
      }),
    });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page).toHaveURL(/\/salons\/s1\/masters\/m1\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
    await expect(page.getByTestId('card-context')).toContainText('Beauty Lab');
  });

  test('shows why a Заблокований master is blocked, and still lets him be edited', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // Not active, so the card asks how many Записи are still ahead of it (§12).
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/masters/m1': apiOk(
        master({ status: 'blocked', blockedAt: '2026-05-01T09:00:00.000Z', blockedReason: 'Спам у відгуках' }),
      ),
    });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('card-blocked-banner')).toContainText('Спам у відгуках');
    await expect(page.getByTestId('profile-edit')).toBeVisible();
  });

  test('offers no editing on a Видалений master', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/masters/m1': apiOk(master({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
    });

    await signIn(page, ADMIN, '/independent-masters/m1');

    await expect(page.getByTestId('card-deleted-banner')).toContainText('Майстра видалено');
    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa');
    await expect(page.getByTestId('profile-edit')).toHaveCount(0);
  });
});

test.describe('independent master profile editing', () => {
  test('sends a PATCH with only the changed fields and the updatedAt the admin saw', async ({ page, mockBackend }) => {
    const saved = master({ name: 'Ion Popa Jr', bufferMinutes: 15, updatedAt: '2026-09-21T10:00:00.000Z' });
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      [PATCH]: apiOk(saved),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();
    // Nothing changed yet — nothing to save.
    await expect(page.getByTestId('edit-save')).toBeDisabled();

    await input(page, 'name').fill('Ion Popa Jr');
    await input(page, 'bufferMinutes').fill('15');
    // Touched and put back: not a change.
    await input(page, 'description').fill('Something else');
    await input(page, 'description').fill('Barber since 2019');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa Jr');
    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa Jr');
    await expect(page.getByTestId('field-buffer')).toContainText('15');
    expect(mock.bodies[PATCH]).toEqual([{ updatedAt: SEEN_UPDATED_AT, name: 'Ion Popa Jr', bufferMinutes: 15 }]);
  });

  test('sends a changed specialization and the optional reason', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      [PATCH]: apiOk(master({ specialization: 'hair_specialist' })),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'specialization').click();
    await page.getByRole('option', { name: 'Спеціаліст з волосся' }).click();
    await input(page, 'reason').fill('Master asked by phone');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-specialization')).toHaveText('Спеціаліст з волосся');
    expect(mock.bodies[PATCH]).toEqual([
      { updatedAt: SEEN_UPDATED_AT, specialization: 'hair_specialist', reason: 'Master asked by phone' },
    ]);
  });

  test('keeps the account email read-only and refuses an invalid value before sending', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters/m1': apiOk(master()) });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();

    await expect(input(page, 'email')).toBeDisabled();
    await expect(input(page, 'email')).toHaveValue('ion@bookme.md');

    await input(page, 'addressZipCode').fill('2012');
    await expect(page.getByTestId('edit-save')).toBeDisabled();
    expect(mock.bodies[PATCH]).toBeUndefined();

    await page.getByTestId('edit-cancel').click();
    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa');
  });

  test('on an edit conflict offers to reload, and reloads the form with the master’s data', async ({
    page,
    mockBackend,
  }) => {
    let reads = 0;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // The second read is the reload: the master renamed himself meanwhile.
      'GET /admin/masters/m1': () =>
        apiOk(reads++ === 0 ? master() : master({ name: 'Ion P.', updatedAt: '2026-09-21T09:00:00.000Z' })),
      [PATCH]: apiError(409, 'EDIT_CONFLICT'),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'description').fill('Admin’s description');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('edit-conflict')).toContainText('Дані змінились');
    // The conflict is the form's own message, not also a toast.
    await expect(page.locator('.p-toast-message')).toHaveCount(0);

    await page.getByTestId('edit-reload').click();

    await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
    await expect(input(page, 'name')).toHaveValue('Ion P.');
    await expect(input(page, 'description')).toHaveValue('Barber since 2019');

    // The next save carries the updatedAt of the reloaded master.
    await input(page, 'description').fill('Admin’s description');
    await page.getByTestId('edit-save').click();
    expect(mock.bodies[PATCH]?.[1]).toEqual({
      updatedAt: '2026-09-21T09:00:00.000Z',
      description: 'Admin’s description',
    });
  });

  test('words any other refusal as a toast and keeps the form open', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      [PATCH]: apiError(409, 'MASTER_ON_ROSTER'),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'name').fill('New');
    await page.getByTestId('edit-save').click();

    await expect(page.locator('.p-toast-message')).toContainText('Це Майстер салону');
    await expect(input(page, 'name')).toHaveValue('New');
  });
});

test.describe('independent master history tab', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('lists the actions over this master, dated on his own clock', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      'GET /admin/audit': (url) =>
        url.searchParams.get('target') === 'master:m1'
          ? apiOk({ items: [auditEntry()], nextCursor: null })
          : apiError(422, 'VALIDATION_ERROR'),
    });

    await signIn(page, ADMIN, '/independent-masters/m1/history');

    const entry = page.getByTestId('history-entry');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Зміна профілю Майстра');
    await expect(entry).toContainText(ADMIN.email);
    // 10:00Z is 13:00 in Chișinău in September.
    await expect(entry).toContainText('13:00');
    await expect(entry).toContainText('Master asked by phone');
    await expect(entry.getByTestId('history-change')).toContainText('Телефон');
    await expect(entry.getByTestId('history-change')).toContainText('+37360000002');
  });

  test('says so when nothing has happened yet, and loads older entries on demand', async ({ page, mockBackend }) => {
    let pages = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      'GET /admin/audit': (url) => {
        if (url.searchParams.get('target') === 'master:empty') {
          return apiOk({ items: [], nextCursor: null });
        }
        return url.searchParams.get('cursor') === 'next-1'
          ? apiOk({ items: [auditEntry({ auditId: 'a2' })], nextCursor: null })
          : apiOk({ items: [auditEntry()], nextCursor: pages++ === 0 ? 'next-1' : null });
      },
      'GET /admin/masters/empty': apiOk(master({ masterId: 'empty' })),
    });

    await signIn(page, ADMIN, '/independent-masters/empty/history');
    await expect(page.getByTestId('history-empty')).toHaveText('Дій над цим Майстром ще не було.');

    await page.goto('/independent-masters/m1/history');
    await expect(page.getByTestId('history-entry')).toHaveCount(1);
    await page.getByTestId('history-more').click();
    await expect(page.getByTestId('history-entry')).toHaveCount(2);
    await expect(page.getByTestId('history-more')).toHaveCount(0);
  });
});
