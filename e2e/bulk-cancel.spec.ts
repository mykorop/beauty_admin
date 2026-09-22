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

const SALON_COUNT = 'GET /admin/salons/s1/appointments/upcoming-count';
const SALON_CANCEL = 'POST /admin/salons/s1/appointments/cancel-upcoming';

test.describe('попередження «N майбутніх Записів»', () => {
  test('stands on a Заблокований Салон and cancels them all with one reason', async ({
    page,
    mockBackend,
  }) => {
    let count = 4;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_COUNT]: () => apiOk({ count }),
      [SALON_CANCEL]: () => {
        count = 0;
        return apiOk({ cancelled: 4, failed: 0, remaining: 0 });
      },
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-upcoming-count')).toContainText('4');
    await page.getByTestId('upcoming-cancel-open').click();
    // The heavy action owes an explanation, as every other one does.
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await expect(page.getByTestId('reason-dialog')).toContainText('Beauty Lab');
    await page.getByTestId('reason-input').fill('  Салон заблоковано ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    // The answer says what is left, so the warning goes without a second read.
    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
    await expect(page.getByText('Скасовано Записів: 4.')).toBeVisible();
    expect(mock.bodies[SALON_CANCEL]).toEqual([{ reason: 'Салон заблоковано' }]);
    // One read, at the moment the banner needed it — the answer replaced it afterwards.
    expect(mock.bodies[SALON_COUNT]).toHaveLength(1);
  });

  test('stands on a Видалений Салон too — cancelling is allowed there', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(
        salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }),
      ),
      [SALON_COUNT]: apiOk({ count: 2 }),
      [SALON_CANCEL]: apiOk({ cancelled: 2, failed: 0, remaining: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    // Блокування is not offered on a Видалений profile; this action still is.
    await expect(page.getByTestId('block-open')).toHaveCount(0);
    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон видалено');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
    expect(mock.bodies[SALON_CANCEL]).toEqual([{ reason: 'Салон видалено' }]);
  });

  test('says what is left when a run does not finish, and lets it be run again', async ({
    page,
    mockBackend,
  }) => {
    const answers = [
      { cancelled: 200, failed: 0, remaining: 30 },
      { cancelled: 30, failed: 0, remaining: 0 },
    ];
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_COUNT]: apiOk({ count: 230 }),
      [SALON_CANCEL]: () => apiOk(answers.shift()),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон заблоковано');
    await page.getByTestId('reason-confirm').click();

    await expect(
      page.getByText('Скасовано Записів: 200. Лишилось: 30 — запустіть дію ще раз.'),
    ).toBeVisible();
    // The banner stays, now naming what is left — the action is idempotent, so pressing again is
    // exactly the remedy.
    await expect(page.getByTestId('card-upcoming-count')).toContainText('30');

    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон заблоковано');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
    expect(mock.bodies[SALON_CANCEL]).toHaveLength(2);
  });

  test('keeps the dialog and the typed reason when the backend refuses', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_COUNT]: apiOk({ count: 3 }),
      [SALON_CANCEL]: apiError(404, 'NOT_FOUND'),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон заблоковано');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Салон заблоковано');
    await expect(page.getByTestId('card-upcoming-count')).toContainText('3');
  });

  test('is not offered on an active Салон — its Записи are nobody’s problem yet', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-title')).toHaveText('Beauty Lab');
    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
    // Nothing shows the number, so nothing reads it either.
    expect(mock.bodies[SALON_COUNT]).toBeUndefined();
  });
});

test.describe('діалог Блокування', () => {
  test('states the number, blocks without cancelling anything, and leaves the action for after', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [SALON_COUNT]: apiOk({ count: 5 }),
      'POST /admin/salons/s1/block': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_CANCEL]: apiOk({ cancelled: 5, failed: 0, remaining: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('block-upcoming')).toContainText('5');
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    // Блокування cancelled nothing: the Записи are still there, now as a warning with its action.
    expect(mock.bodies[SALON_CANCEL]).toBeUndefined();
    await expect(page.getByTestId('card-upcoming-count')).toContainText('5');

    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон заблоковано');
    await page.getByTestId('reason-confirm').click();
    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
  });

  test('offers the масове скасування from inside itself, as its own confirmed step', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [SALON_COUNT]: apiOk({ count: 5 }),
      [SALON_CANCEL]: apiOk({ cancelled: 5, failed: 0, remaining: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Typed for the Блокування');
    await page.getByTestId('block-upcoming-cancel').click();

    // The offer swaps one dialog for the other, and a reason typed for Блокування never travels.
    const bulk = page.getByRole('dialog', { name: 'Масове скасування Записів' });
    await expect(bulk).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Блокування профілю' })).toHaveCount(0);
    await expect(bulk.getByTestId('reason-input')).toHaveValue('');
    await bulk.getByTestId('reason-input').fill('Клієнтів треба попередити');
    await bulk.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    expect(mock.bodies[SALON_CANCEL]).toEqual([{ reason: 'Клієнтів треба попередити' }]);
    // Блокування itself was never sent: the offer is a separate decision, not a bundled one.
    expect(mock.bodies['POST /admin/salons/s1/block']).toBeUndefined();
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
  });

  test('says nothing about Записи when there are none, and nothing when lifting a Блокування', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_COUNT]: apiOk({ count: 0 }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    // Nothing ahead: no banner, and no line inside the dialog that lifts the Блокування either.
    await expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0);
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('block-upcoming')).toHaveCount(0);
  });
});

test.describe('Незалежний майстер', () => {
  test('carries the same warning and the same action on his own card', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master({ status: 'blocked', ...BLOCKED })),
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 2 }),
      'POST /admin/masters/m1/appointments/cancel-upcoming': apiOk({
        cancelled: 1,
        failed: 1,
        remaining: 1,
      }),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await expect(page.getByTestId('card-upcoming-count')).toContainText('2');
    await page.getByTestId('upcoming-cancel-open').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Ion Popa');
    await page.getByTestId('reason-input').fill('Майстер не працює');
    await page.getByTestId('reason-confirm').click();

    // One refused: the warning stays, naming what is still standing.
    await expect(
      page.getByText('Скасовано Записів: 1. Лишилось: 1 — запустіть дію ще раз.'),
    ).toBeVisible();
    await expect(page.getByTestId('card-upcoming-count')).toContainText('1');
    expect(mock.bodies['POST /admin/masters/m1/appointments/cancel-upcoming']).toEqual([
      { reason: 'Майстер не працює' },
    ]);
  });
});

test.describe('Журнал дій', () => {
  test('reads a bulk row with every Запис it touched', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'blocked', ...BLOCKED })),
      [SALON_COUNT]: apiOk({ count: 0 }),
      'GET /admin/audit': apiOk({
        items: [
          {
            auditId: 'a1',
            adminId: 'e2e-user-sub',
            adminEmail: ADMIN.email,
            targetType: 'salon',
            targetId: 's1',
            salonId: 's1',
            action: 'appointment.bulk-cancel',
            createdAt: '2026-09-22T09:00:00.000Z',
            changes: [
              { field: 'appointments.appt-1.status', before: 'BOOKED', after: 'CANCELLED' },
              { field: 'appointments.appt-2.status', before: 'BOOKED', after: 'CANCELLED' },
            ],
            reason: 'Салон заблоковано',
            affected: [
              { type: 'appointment', id: 'appt-1' },
              { type: 'appointment', id: 'appt-2' },
            ],
          },
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    await expect(page.getByTestId('history-entry')).toContainText('Масове скасування Записів');
    // Each Запис by name, with its state worded rather than printed as the backend spells it.
    const changes = page.getByTestId('history-change');
    await expect(changes).toHaveCount(2);
    await expect(changes.first()).toContainText('Запис appt-1');
    await expect(changes.first()).toContainText('Заброньовано');
    await expect(changes.first()).toContainText('Скасовано');
    await expect(page.getByTestId('history-reason')).toContainText('Салон заблоковано');
    await expect(page.getByTestId('history-affected-entity')).toHaveCount(2);
    await expect(page.getByTestId('history-affected-entity').first()).toHaveText('Запис appt-1');
  });
});
