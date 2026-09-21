import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const COPIES_PATH = '/admin/salons/s1/masters/m2/services';
const TAB = '/salons/s1/masters/m2/services';

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

const catalogService = (overrides: Record<string, unknown> = {}) => ({
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  masterCopyCount: 1,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

/** A Копія with the master's own price and duration, next to the Каталог's. */
const copy = (overrides: Record<string, unknown> = {}) => ({
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 45,
  price: 700,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  catalog: { durationMinutes: 30, price: 500, isActive: true },
  createdAt: '2026-04-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

const BEARD = catalogService({
  serviceId: 'svc2',
  name: 'Beard trim',
  category: 'beard_and_mustache',
  durationMinutes: 20,
  price: 250,
  masterCopyCount: 0,
});

const base = (copies: unknown[], catalog: unknown[] = [catalogService()], salonOverrides = {}) => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon(salonOverrides)),
  'GET /admin/salons/s1/masters/m2': apiOk(MASTER),
  'GET /admin/salons/s1/services': apiOk({ items: catalog }),
  [`GET ${COPIES_PATH}`]: apiOk({ items: copies }),
});

test.describe('salon master service copies', () => {
  test('lists the Копії with their own price and duration next to the Каталог values', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      base([
        copy(),
        copy({
          serviceId: 'svc2',
          name: 'Beard trim',
          category: 'beard_and_mustache',
          durationMinutes: 20,
          price: 250,
          catalog: { durationMinutes: 20, price: 250, isActive: false },
        }),
        copy({ serviceId: 'svc3', name: 'Styling', category: 'styling', isActive: false, catalog: null }),
      ]),
    );
    await signIn(page, ADMIN, TAB);

    const rows = page.getByTestId('copy-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).getByTestId('copy-row-name')).toHaveText('Haircut');
    await expect(rows.nth(0).getByTestId('copy-row-category')).toHaveText('Стрижки');
    await expect(rows.nth(0).getByTestId('copy-row-duration')).toHaveText('45 хв');
    await expect(rows.nth(0).getByTestId('copy-row-catalog-duration')).toHaveText('30 хв');
    await expect(rows.nth(0).getByTestId('copy-row-price')).toContainText('700 MDL');
    await expect(rows.nth(0).getByTestId('copy-row-catalog-price')).toHaveText('500 MDL');
    await expect(rows.nth(0).getByTestId('copy-row-active')).toHaveText('Активна');
    await expect(rows.nth(0).getByTestId('copy-row-not-offered')).toHaveCount(0);

    // Switched on, yet nobody can book it: the Каталог service is deactivated.
    await expect(rows.nth(1).getByTestId('copy-row-not-offered')).toContainText('деактивовано в Каталозі');
    // A switched-off Копія says so itself; the Каталог no longer holds its service.
    await expect(rows.nth(2).getByTestId('copy-row-active')).toHaveText('Деактивована');
    await expect(rows.nth(2).getByTestId('copy-row-catalog-price')).toHaveText('—');
    await expect(rows.nth(2).getByTestId('copy-row-not-offered')).toHaveCount(0);
    await expect(page.getByTestId('copies-note')).toBeVisible();
  });

  test('edits price, duration and activity of a Копія — only what changed', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([copy()]),
      [`PATCH ${COPIES_PATH}/svc1`]: apiOk(
        copy({ price: 800, isActive: false, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-edit').click();
    await expect(page.getByTestId('copy-service-name')).toHaveText('Haircut');
    await expect(page.getByTestId('copy-catalog-price')).toContainText('500 MDL');
    await expect(page.getByTestId('copy-catalog-duration')).toContainText('30 хв');
    await expect(page.getByTestId('copy-save')).toBeDisabled();

    // Typed over and put back is not a change.
    await page.getByTestId('copy-duration').fill('60');
    await page.getByTestId('copy-duration').fill('45');
    await expect(page.getByTestId('copy-save')).toBeDisabled();

    await page.getByTestId('copy-price').fill('800');
    await page.getByTestId('copy-active').click();
    await page.getByTestId('copy-reason').fill('Owner asked by phone');
    await page.getByTestId('copy-save').click();

    await expect(page.getByTestId('copy-row-price')).toContainText('800 MDL');
    await expect(page.getByTestId('copy-row-active')).toHaveText('Деактивована');
    expect(mock.bodies[`PATCH ${COPIES_PATH}/svc1`]).toEqual([
      { updatedAt: '2026-06-01T00:00:00.000Z', price: 800, isActive: false, reason: 'Owner asked by phone' },
    ]);
  });

  test('adds a Копія from the Каталог, starting from its price and duration', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([copy()], [catalogService(), BEARD]),
      [`POST ${COPIES_PATH}`]: {
        status: 201,
        body: apiOk(
          copy({
            serviceId: 'svc2',
            name: 'Beard trim',
            category: 'beard_and_mustache',
            durationMinutes: 20,
            price: 300,
            catalog: { durationMinutes: 20, price: 250, isActive: true },
          }),
        ).body,
      },
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-new').click();
    await expect(page.getByTestId('copy-save')).toBeDisabled();

    // Only what the master does not hold yet is on offer.
    await page.getByTestId('copy-service').click();
    await expect(page.getByRole('option')).toHaveText(['Beard trim']);
    await page.getByRole('option', { name: 'Beard trim' }).click();

    await expect(page.getByTestId('copy-price')).toHaveValue('250');
    await expect(page.getByTestId('copy-duration')).toHaveValue('20');
    await page.getByTestId('copy-price').fill('300');
    await page.getByTestId('copy-save').click();

    await expect(page.getByTestId('copy-row')).toHaveCount(2);
    await expect(page.getByTestId('copy-row').nth(1).getByTestId('copy-row-price')).toContainText('300 MDL');
    expect(mock.bodies[`POST ${COPIES_PATH}`]).toEqual([{ serviceId: 'svc2', price: 300, durationMinutes: 20 }]);
    // Every Каталог service is now held.
    await expect(page.getByTestId('copy-new')).toBeDisabled();
    await expect(page.getByTestId('copy-new-none')).toBeVisible();
  });

  test('removes a Копія only after a second click', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([copy()]),
      [`DELETE ${COPIES_PATH}/svc1`]: apiOk({ removed: true, serviceId: 'svc1' }),
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-remove').click();
    await page.getByTestId('copy-remove-cancel').click();
    await expect(page.getByTestId('copy-row')).toHaveCount(1);
    expect(mock.bodies[`DELETE ${COPIES_PATH}/svc1`]).toBeUndefined();

    await page.getByTestId('copy-remove').click();
    await page.getByTestId('copy-remove-confirm').click();

    await expect(page.getByTestId('copies-empty')).toBeVisible();
    // The service is back among what can be added.
    await expect(page.getByTestId('copy-new')).toBeEnabled();
  });

  test('offers to reload when the Копія was edited meanwhile', async ({ page, mockBackend }) => {
    let reads = 0;
    await mockBackend(ADMIN, {
      ...base([]),
      [`GET ${COPIES_PATH}`]: () =>
        apiOk({ items: [reads++ === 0 ? copy() : copy({ price: 750, updatedAt: '2026-09-21T10:00:00.000Z' })] }),
      [`PATCH ${COPIES_PATH}/svc1`]: apiError(409, 'EDIT_CONFLICT'),
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-edit').click();
    await page.getByTestId('copy-price').fill('800');
    await page.getByTestId('copy-save').click();

    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();
    await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
    await expect(page.getByTestId('copy-price')).toHaveValue('750');
  });

  test('is read-only inside a Видалений salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, base([copy()], [catalogService(), BEARD], { status: 'deleted' }));
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('copy-row')).toHaveCount(1);
    await expect(page.getByTestId('copy-new')).toHaveCount(0);
    await expect(page.getByTestId('copy-edit')).toHaveCount(0);
    await expect(page.getByTestId('copy-remove')).toHaveCount(0);
  });

  test('words an added and a removed Копія in the Журнал дій as a line, not as raw data', async ({
    page,
    mockBackend,
  }) => {
    const entry = (auditId: string, action: string, before: unknown, after: unknown) => ({
      auditId,
      adminId: 'e2e-user-sub',
      adminEmail: ADMIN.email,
      targetType: 'master',
      targetId: 'm2',
      salonId: 's1',
      action,
      createdAt: '2026-09-21T10:00:00.000Z',
      changes: [{ field: 'services.svc1', before, after }],
      reason: null,
      affected: [],
    });
    const held = { name: 'Haircut', durationMinutes: 45, price: 700, currency: 'MDL', priceUnit: '', isActive: true };
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/audit': apiOk({
        items: [
          entry('a2', 'salon.master.service.remove', held, null),
          entry('a1', 'salon.master.service.create', null, held),
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/audit-log');

    const rows = page.getByTestId('audit-row');
    await expect(rows.nth(0)).toContainText('Прибирання Копії послуги Майстра');
    await expect(rows.nth(1)).toContainText('Додавання Копії послуги Майстру');

    await rows.nth(0).getByTestId('audit-row-toggle').click();
    const change = page.getByTestId('history-change');
    await expect(change).toContainText('Послуга');
    await expect(change).toContainText('Haircut · 45 хв · 700 MDL');
    await expect(change).not.toContainText('{');
  });

  test('drops a Копія the Власник салону removed first', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      ...base([copy()]),
      [`DELETE ${COPIES_PATH}/svc1`]: apiError(404, 'NOT_FOUND'),
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-remove').click();
    await page.getByTestId('copy-remove-confirm').click();

    await expect(page.getByTestId('copies-empty')).toBeVisible();
  });

  test('says so when the Копія already existed and the typed price was not written', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      ...base([], [BEARD]),
      // The idempotent POST answers with what the Власник салону stored a moment ago.
      [`POST ${COPIES_PATH}`]: {
        status: 201,
        body: apiOk(copy({ serviceId: 'svc2', name: 'Beard trim', price: 400, durationMinutes: 20 })).body,
      },
    });
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('copy-new').click();
    await page.getByTestId('copy-service').click();
    await page.getByRole('option', { name: 'Beard trim' }).click();
    await page.getByTestId('copy-price').fill('300');
    await page.getByTestId('copy-save').click();

    await expect(page.getByText('Майстер уже мав цю Копію')).toBeVisible();
    await expect(page.getByTestId('copy-row-price')).toContainText('400 MDL');
  });
});
