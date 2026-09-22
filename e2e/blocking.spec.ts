import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const BLOCKED = { blockedAt: '2026-09-22T08:00:00.000Z', blockedReason: 'Fraud reports' };

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
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
  description: 'Barber',
  addressStreet: 'Strada Mihai',
  addressHouseNumber: '4',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: 'Chișinău',
  addressZipCode: 'MD-2012',
  addressCountry: 'MD',
  locationLatitude: null,
  locationLongitude: null,
  phone: '+37360000002',
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

test.describe('блокування Салону', () => {
  // Far from the salon's zone on purpose: the banner must date the block in the salon's, not here.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('asks for a reason, sends it, and the card comes back Заблокований', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      // The Блокування dialog states how many Записи the profile still has ahead of it (§12).
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'POST /admin/salons/s1/block': apiOk(salon({ status: 'blocked', ...BLOCKED })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Beauty Lab');
    // Blanks are not a reason.
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await page.getByTestId('reason-input').fill('   ');
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await page.getByTestId('reason-input').fill('  Fraud reports ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    const banner = page.getByTestId('card-blocked-banner');
    await expect(banner).toContainText('Fraud reports');
    // 08:00 UTC is 11:00 in Chișinău, and the browser is nine hours behind it.
    await expect(banner).toContainText('11:00');
    // The action now offers the other direction.
    await expect(page.getByTestId('block-open')).toHaveText('Зняти Блокування');
    expect(mock.bodies['POST /admin/salons/s1/block']).toEqual([{ reason: 'Fraud reports' }]);
  });

  test('lifts a Блокування with its own reason', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'POST /admin/salons/s1/unblock': apiOk(salon()),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-blocked-banner')).toBeVisible();
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Beauty Lab');
    await page.getByTestId('reason-input').fill('Owner provided the documents');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('block-open')).toHaveText('Заблокувати');
    expect(mock.bodies['POST /admin/salons/s1/unblock']).toEqual([
      { reason: 'Owner provided the documents' },
    ]);
  });

  test('keeps the dialog and the typed reason when the backend refuses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      // The Блокування dialog states how many Записи the profile still has ahead of it (§12).
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'POST /admin/salons/s1/block': apiError(409, 'PROFILE_ALREADY_BLOCKED'),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Fraud reports');
    await expect(page.getByText('Профіль уже заблоковано. Оновіть сторінку.')).toBeVisible();
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
  });

  test('cancelling sends nothing and forgets what was typed', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Changed my mind');
    await page.getByTestId('reason-cancel').click();
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);

    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-input')).toHaveValue('');
    expect(mock.bodies['POST /admin/salons/s1/block']).toBeUndefined();
  });

  test('is not offered on a Видалений Салон — every write action refuses there', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('block-open')).toHaveCount(0);
  });
});

test.describe('блокування Незалежного майстра', () => {
  test('blocks and unblocks him from his own card', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }),
      'POST /admin/masters/m1/block': apiOk(master({ status: 'blocked', ...BLOCKED })),
      'POST /admin/masters/m1/unblock': apiOk(master()),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Ion Popa');
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('card-blocked-banner')).toContainText('Fraud reports');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Sorted out');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    expect(mock.bodies['POST /admin/masters/m1/block']).toEqual([{ reason: 'Fraud reports' }]);
    expect(mock.bodies['POST /admin/masters/m1/unblock']).toEqual([{ reason: 'Sorted out' }]);
  });
});

test.describe('Журнал дій', () => {
  test('reads a Блокування row with both fields and the reason', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/audit': apiOk({
        items: [
          {
            auditId: 'a1',
            adminId: 'e2e-user-sub',
            adminEmail: ADMIN.email,
            targetType: 'salon',
            targetId: 's1',
            salonId: 's1',
            action: 'salon.block',
            createdAt: '2026-09-22T08:00:00.000Z',
            changes: [
              { field: 'blockedAt', before: null, after: BLOCKED.blockedAt },
              { field: 'blockedReason', before: null, after: BLOCKED.blockedReason },
            ],
            reason: 'Fraud reports',
            affected: [],
          },
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    const changes = page.getByTestId('history-change');
    await expect(changes).toHaveCount(2);
    await expect(changes.first()).toContainText('Заблоковано');
    await expect(changes.nth(1)).toContainText('Причина Блокування');
    await expect(page.getByTestId('history-reason')).toContainText('Fraud reports');
  });
});
