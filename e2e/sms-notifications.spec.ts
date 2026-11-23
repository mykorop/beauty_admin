import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const PUT = 'PUT /admin/salons/s1/sms-notifications';
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
  smsNotificationsEnabled: false,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

const checkbox = (page: import('@playwright/test').Page) =>
  page.getByTestId('sms-notifications').locator('input');

/**
 * «SMS-сповіщення клієнтам» — a checkbox on the Профіль tab of a Салон's card that only the
 * Адміністратор платформи changes. Every change goes through the «дія з причиною» dialog, whose
 * reason is optional here, and the card takes the salon the backend answers with.
 */
test.describe('SMS-сповіщення клієнтам Салону', () => {
  test('shows the setting as the Салон has it, with what it means', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ smsNotificationsEnabled: true })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    const field = page.getByTestId('field-smsNotifications');
    await expect(field).toContainText('SMS платні');
    await expect(page.getByText('SMS-сповіщення клієнтам')).toBeVisible();
    await expect(checkbox(page)).toBeChecked();
    await expect(checkbox(page)).toBeEnabled();
  });

  test('turning it on asks for an optional reason, sends PUT and the card takes the answer', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [PUT]: apiOk(salon({ smsNotificationsEnabled: true, updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');
    await expect(checkbox(page)).not.toBeChecked();

    await checkbox(page).click();

    const dialog = page.getByTestId('reason-dialog');
    await expect(dialog).toContainText('Beauty Lab');
    await expect(dialog).toContainText('SMS платні');
    await expect(dialog).toContainText('Причина (необов’язково)');
    // No reason is owed: confirming with the field left blank is allowed.
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-confirm').click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('SMS-сповіщення увімкнено.')).toBeVisible();
    await expect(checkbox(page)).toBeChecked();
    // The card is the salon the backend answered with — its new clock included: 10:00Z is 13:00
    // in Chișinău in September, where the one it was read with said 14:30.
    await expect(page.getByTestId('field-updatedAt')).toContainText('13:00');
    expect(mock.bodies[PUT]).toEqual([{ enabled: true }]);
  });

  test('turning it off sends the reason typed', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ smsNotificationsEnabled: true })),
      [PUT]: apiOk(salon({ smsNotificationsEnabled: false })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await checkbox(page).click();
    await expect(page.getByTestId('reason-dialog')).toContainText('більше не отримуватимуть');
    await page.getByTestId('reason-input').fill('  Owner stopped paying ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByText('SMS-сповіщення вимкнено.')).toBeVisible();
    await expect(checkbox(page)).not.toBeChecked();
    expect(mock.bodies[PUT]).toEqual([{ enabled: false, reason: 'Owner stopped paying' }]);
  });

  test('cancelling sends nothing and puts the checkbox back', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await checkbox(page).click();
    await page.getByTestId('reason-cancel').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(checkbox(page)).not.toBeChecked();
    expect(mock.bodies[PUT]).toBeUndefined();
  });

  test('keeps the dialog open when the backend refuses, and the card as it was', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [PUT]: apiError(409, 'SALON_DELETED'),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await checkbox(page).click();
    await page.getByTestId('reason-input').fill('Agreed by phone');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Agreed by phone');
    await page.getByTestId('reason-cancel').click();
    await expect(checkbox(page)).not.toBeChecked();
  });

  test('can be changed on a Заблокований Салон', async ({ page, mockBackend }) => {
    const blocked = {
      status: 'blocked',
      blockedAt: '2026-09-22T08:00:00.000Z',
      blockedReason: 'Fraud',
    };
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(blocked)),
      // Not active, so the card asks how many Записи are still ahead of it (§12).
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      [PUT]: apiOk(salon({ ...blocked, smsNotificationsEnabled: true })),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await checkbox(page).click();
    await page.getByTestId('reason-confirm').click();

    await expect(checkbox(page)).toBeChecked();
    expect(mock.bodies[PUT]).toEqual([{ enabled: true }]);
  });

  test('is disabled on a Видалений Салон', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(
        salon({
          status: 'deleted',
          deletedAt: '2026-08-01T12:00:00.000Z',
          smsNotificationsEnabled: true,
        }),
      ),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(checkbox(page)).toBeChecked();
    await expect(checkbox(page)).toBeDisabled();
  });

  test('«Історія» names the action and the field', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ smsNotificationsEnabled: true })),
      'GET /admin/audit': (url) =>
        url.searchParams.get('target') === 'salon:s1'
          ? apiOk({
              items: [
                {
                  auditId: 'a1',
                  adminId: 'e2e-user-sub',
                  adminEmail: ADMIN.email,
                  targetType: 'salon',
                  targetId: 's1',
                  salonId: 's1',
                  action: 'salon.sms_notifications.update',
                  createdAt: '2026-09-21T10:00:00.000Z',
                  changes: [{ field: 'smsNotificationsEnabled', before: false, after: true }],
                  reason: 'Paid plan agreed',
                  affected: [],
                },
              ],
              nextCursor: null,
            })
          : apiError(422, 'VALIDATION_ERROR'),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    const entry = page.getByTestId('history-entry');
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Зміна SMS-сповіщень клієнтам');
    await expect(entry).toContainText('Paid plan agreed');
    const change = entry.getByTestId('history-change');
    await expect(change).toContainText('SMS-сповіщення клієнтам');
    await expect(change).toContainText('ні');
    await expect(change).toContainText('так');
  });
});
