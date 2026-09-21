import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const PATCH = 'PATCH /admin/salons/s1/profile';
const SEEN_UPDATED_AT = '2026-05-02T11:30:00.000Z';

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: 'Hair and nails',
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
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

const auditEntry = (overrides: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: ADMIN.email,
  targetType: 'salon',
  targetId: 's1',
  salonId: 's1',
  action: 'salon.profile.update',
  createdAt: '2026-09-21T10:00:00.000Z',
  changes: [
    { field: 'phone', before: '+37360000001', after: '+37360000002' },
    { field: 'brandColor', before: null, after: '#aa3366' },
  ],
  reason: 'Owner asked by phone',
  ...overrides,
});

const input = (page: import('@playwright/test').Page, name: string) => page.getByTestId(`edit-${name}`);

test.describe('salon profile editing', () => {
  test('sends a PATCH with only the changed fields and the updatedAt the admin saw', async ({
    page,
    mockBackend,
  }) => {
    const saved = salon({ name: 'Beauty Lab 2', bufferMinutes: 15, updatedAt: '2026-09-21T10:00:00.000Z' });
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [PATCH]: apiOk(saved),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();
    // Nothing changed yet — nothing to save.
    await expect(page.getByTestId('edit-save')).toBeDisabled();

    await input(page, 'name').fill('Beauty Lab 2');
    await input(page, 'bufferMinutes').fill('15');
    // Touched and put back: not a change.
    await input(page, 'description').fill('Something else');
    await input(page, 'description').fill('Hair and nails');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab 2');
    await expect(page.getByTestId('card-title')).toHaveText('Beauty Lab 2');
    await expect(page.getByTestId('field-buffer')).toContainText('15');
    expect(mock.bodies[PATCH]).toEqual([{ updatedAt: SEEN_UPDATED_AT, name: 'Beauty Lab 2', bufferMinutes: 15 }]);
  });

  test('sends the optional reason along, and an emptied brand colour as null', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [PATCH]: apiOk(salon({ brandColor: null })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'brandColor').fill('');
    await input(page, 'reason').fill('Owner asked by phone');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-brandColor')).toHaveText('—');
    expect(mock.bodies[PATCH]).toEqual([
      { updatedAt: SEEN_UPDATED_AT, brandColor: null, reason: 'Owner asked by phone' },
    ]);
  });

  test('keeps the account email read-only and refuses an invalid value before sending', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons/s1': apiOk(salon()) });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();

    await expect(input(page, 'email')).toBeDisabled();
    await expect(input(page, 'email')).toHaveValue('ana@beautylab.md');

    await input(page, 'addressZipCode').fill('2012');
    await expect(page.getByTestId('edit-save')).toBeDisabled();
    expect(mock.bodies[PATCH]).toBeUndefined();

    await page.getByTestId('edit-cancel').click();
    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab');
  });

  test('on an edit conflict offers to reload, and reloads the form with the owner’s data', async ({
    page,
    mockBackend,
  }) => {
    let reads = 0;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // The second read is the reload: the owner renamed the salon meanwhile.
      'GET /admin/salons/s1': () =>
        apiOk(reads++ === 0 ? salon() : salon({ name: 'Owner’s Name', updatedAt: '2026-09-21T09:00:00.000Z' })),
      [PATCH]: apiError(409, 'EDIT_CONFLICT'),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'description').fill('Admin’s description');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('edit-conflict')).toContainText('Дані змінились');
    // The conflict is the form's own message, not also a toast.
    await expect(page.locator('.p-toast-message')).toHaveCount(0);

    await page.getByTestId('edit-reload').click();

    await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
    await expect(input(page, 'name')).toHaveValue('Owner’s Name');
    await expect(input(page, 'description')).toHaveValue('Hair and nails');
    await expect(page.getByTestId('card-title')).toHaveText('Owner’s Name');

    // The next save carries the updatedAt of the reloaded salon.
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
      'GET /admin/salons/s1': apiOk(salon()),
      [PATCH]: apiError(409, 'SALON_DELETED'),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();
    await input(page, 'name').fill('New');
    await page.getByTestId('edit-save').click();

    await expect(page.locator('.p-toast-message')).toContainText('Салон видалено');
    await expect(input(page, 'name')).toHaveValue('New');
  });

  test('offers no editing on a Deleted salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab');
    await expect(page.getByTestId('profile-edit')).toHaveCount(0);
  });
});

test.describe('salon history tab', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('lists the actions over the salon with full old and new values and the reason', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/audit': (url) =>
        url.searchParams.get('target') === 'salon:s1'
          ? apiOk({ items: [auditEntry()], nextCursor: null })
          : apiError(422, 'VALIDATION_ERROR'),
    });

    await signIn(page, ADMIN, '/salons/s1/history');

    const entry = page.getByTestId('history-entry');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Зміна профілю');
    await expect(entry).toContainText(ADMIN.email);
    // 10:00Z is 13:00 in Chișinău in September.
    await expect(entry).toContainText('13:00');
    await expect(entry).toContainText('Owner asked by phone');

    const changes = entry.getByTestId('history-change');
    await expect(changes).toHaveCount(2);
    await expect(changes.nth(0)).toContainText('Телефон');
    await expect(changes.nth(0)).toContainText('+37360000001');
    await expect(changes.nth(0)).toContainText('+37360000002');
    await expect(changes.nth(1)).toContainText('Колір бренду');
    await expect(changes.nth(1)).toContainText('—');
  });

  test('shows a saved edit right away', async ({ page, mockBackend }) => {
    let saved = false;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [PATCH]: () => {
        saved = true;
        return apiOk(salon({ name: 'Beauty Lab 2' }));
      },
      'GET /admin/audit': () =>
        apiOk({
          items: saved
            ? [auditEntry({ changes: [{ field: 'name', before: 'Beauty Lab', after: 'Beauty Lab 2' }], reason: null })]
            : [],
          nextCursor: null,
        }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');
    await expect(page.getByTestId('history-empty')).toBeVisible();

    await page.getByTestId('card-tab').filter({ hasText: 'Профіль' }).click();
    await page.getByTestId('profile-edit').click();
    await input(page, 'name').fill('Beauty Lab 2');
    await page.getByTestId('edit-save').click();
    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab 2');

    await page.getByTestId('card-tab').filter({ hasText: 'Історія' }).click();

    await expect(page.getByTestId('history-change')).toContainText('Beauty Lab 2');
  });

  test('loads older entries on demand', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/audit': (url) =>
        url.searchParams.get('cursor') === 'next-1'
          ? apiOk({ items: [auditEntry({ auditId: 'a2' })], nextCursor: null })
          : apiOk({ items: [auditEntry()], nextCursor: 'next-1' }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    await expect(page.getByTestId('history-entry')).toHaveCount(1);
    await page.getByTestId('history-more').click();

    await expect(page.getByTestId('history-entry')).toHaveCount(2);
    await expect(page.getByTestId('history-more')).toHaveCount(0);
  });
});
