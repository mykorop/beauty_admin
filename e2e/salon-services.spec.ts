import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SERVICES_PATH = '/admin/salons/s1/services';

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

const service = (overrides: Record<string, unknown> = {}) => ({
  serviceId: 'svc1',
  name: 'Haircut',
  description: 'Wash and cut',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  masterCopyCount: 2,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

const DICTIONARIES = apiOk({
  serviceCategories: ['haircut', 'styling', 'beard_and_mustache'],
  specializations: ['barber'],
  serviceCurrencies: ['MDL'],
});

const base = (items: unknown[], salonOverrides: Record<string, unknown> = {}) => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon(salonOverrides)),
  'GET /admin/dictionaries': DICTIONARIES,
  [`GET ${SERVICES_PATH}`]: apiOk({ items }),
});

test.describe('salon service catalog', () => {
  test('lists the Каталог with category, duration, price, currency, activity and Копії count', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      base([
        service(),
        service({
          serviceId: 'svc2',
          name: 'Beard trim',
          category: 'beard_and_mustache',
          isActive: false,
          masterCopyCount: 0,
        }),
      ]),
    );
    await signIn(page, ADMIN, '/salons/s1/services');

    const rows = page.getByTestId('service-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId('service-row-name')).toHaveText('Haircut');
    await expect(rows.nth(0).getByTestId('service-row-category')).toHaveText('Стрижки');
    await expect(rows.nth(0).getByTestId('service-row-duration')).toHaveText('30 хв');
    await expect(rows.nth(0).getByTestId('service-row-price')).toContainText('500');
    await expect(rows.nth(0).getByTestId('service-row-currency')).toHaveText('MDL');
    await expect(rows.nth(0).getByTestId('service-row-active')).toHaveText('Активна');
    await expect(rows.nth(0).getByTestId('service-row-copies')).toHaveText('2');
    await expect(rows.nth(1).getByTestId('service-row-category')).toHaveText('Барберинг');
    await expect(rows.nth(1).getByTestId('service-row-active')).toHaveText('Деактивована');
    await expect(page.getByTestId('services-copies-note')).toBeVisible();
  });

  test('creates a new service — in MDL only', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([]),
      [`POST ${SERVICES_PATH}`]: {
        status: 201,
        body: apiOk(
          service({
            serviceId: 'svc9',
            name: 'Beard trim',
            category: 'beard_and_mustache',
            durationMinutes: 20,
            price: 250,
            masterCopyCount: 0,
          }),
        ).body,
      },
    });
    await signIn(page, ADMIN, '/salons/s1/services');
    await expect(page.getByTestId('services-empty')).toBeVisible();

    await page.getByTestId('service-new').click();
    await expect(page.getByTestId('service-mdl-only')).toBeVisible();
    await expect(page.getByTestId('service-save')).toBeDisabled();

    // The only currency on offer is MDL.
    await page.getByTestId('service-currency').click();
    await expect(page.getByRole('option')).toHaveText(['MDL']);
    await page.keyboard.press('Escape');

    await page.getByTestId('service-name').fill('Beard trim');
    await page.getByTestId('service-category').click();
    await page.getByRole('option', { name: 'Барберинг' }).click();
    await page.getByTestId('service-duration').fill('20');
    await page.getByTestId('service-price').fill('250');
    // A new service has no Копії to warn about.
    await expect(page.getByTestId('service-copies-warning')).toHaveCount(0);
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-row-name')).toHaveText('Beard trim');
    expect(mock.bodies[`POST ${SERVICES_PATH}`]).toEqual([
      {
        name: 'Beard trim',
        description: '',
        category: 'beard_and_mustache',
        durationMinutes: 20,
        price: 250,
        currency: 'MDL',
        isActive: true,
      },
    ]);
  });

  test('warns that Копії майстрів do not change once price or duration is touched', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([service()]),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiOk(service({ price: 600, updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/salons/s1/services');

    await page.getByTestId('service-edit').click();
    await expect(page.getByTestId('service-copies-warning')).toHaveCount(0);
    await expect(page.getByTestId('service-save')).toBeDisabled();

    // A rename alone is not something the Копії keep for themselves.
    await page.getByTestId('service-name').fill('Classic haircut');
    await expect(page.getByTestId('service-copies-warning')).toHaveCount(0);
    await page.getByTestId('service-name').fill('Haircut');

    await page.getByTestId('service-duration').fill('40');
    await expect(page.getByTestId('service-copies-warning')).toContainText('Копії майстрів не змінюються');
    await page.getByTestId('service-duration').fill('30');
    await expect(page.getByTestId('service-copies-warning')).toHaveCount(0);

    await page.getByTestId('service-price').fill('600');
    await expect(page.getByTestId('service-copies-warning')).toContainText('2');
    await page.getByTestId('service-reason').fill('Owner asked by phone');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('service-row-price')).toContainText('600');
    // Only the changed field, under the `updatedAt` the form was opened with.
    expect(mock.bodies[`PATCH ${SERVICES_PATH}/svc1`]).toEqual([
      { updatedAt: '2026-06-01T00:00:00.000Z', price: 600, reason: 'Owner asked by phone' },
    ]);
  });

  test('offers to reload when the Власник салону edited the service meanwhile', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      ...base([service()]),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiError(409, 'EDIT_CONFLICT'),
      [`GET ${SERVICES_PATH}/svc1`]: apiOk(service({ name: 'Haircut deluxe', updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/salons/s1/services');

    await page.getByTestId('service-edit').click();
    await page.getByTestId('service-price').fill('600');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();
    await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
    await expect(page.getByTestId('service-name')).toHaveValue('Haircut deluxe');
    await expect(page.getByTestId('service-price')).toHaveValue('500');
  });

  test('deactivates a service and brings it back — it is never deleted', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([service()]),
      [`DELETE ${SERVICES_PATH}/svc1`]: apiOk(service({ isActive: false, updatedAt: '2026-09-21T10:00:00.000Z' })),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiOk(service({ updatedAt: '2026-09-21T10:05:00.000Z' })),
    });
    await signIn(page, ADMIN, '/salons/s1/services');

    await page.getByTestId('service-deactivate').click();
    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-row-active')).toHaveText('Деактивована');

    await page.getByTestId('service-activate').click();
    await expect(page.getByTestId('service-row-active')).toHaveText('Активна');
    expect(mock.bodies[`PATCH ${SERVICES_PATH}/svc1`]).toEqual([
      { updatedAt: '2026-09-21T10:00:00.000Z', isActive: true },
    ]);
  });

  test('never re-denominates a legacy price: the currency of an existing service is not editable', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      ...base([service({ currency: 'EUR', price: 40 })]),
      [`PATCH ${SERVICES_PATH}/svc1`]: apiOk(service({ currency: 'EUR', price: 45 })),
    });
    await signIn(page, ADMIN, '/salons/s1/services');

    await page.getByTestId('service-edit').click();
    await expect(page.getByTestId('service-currency')).toContainText('EUR');
    await expect(page.getByTestId('service-currency').getByRole('combobox')).toBeDisabled();

    await page.getByTestId('service-price').fill('45');
    await page.getByTestId('service-save').click();

    await expect(page.getByTestId('service-row-currency')).toHaveText('EUR');
    expect(mock.bodies[`PATCH ${SERVICES_PATH}/svc1`]).toEqual([{ updatedAt: '2026-06-01T00:00:00.000Z', price: 45 }]);
  });

  test('words a created service in the «Історія» as a line, not as raw data', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/audit': apiOk({
        items: [
          {
            auditId: 'a1',
            adminId: 'e2e-user-sub',
            adminEmail: ADMIN.email,
            targetType: 'salon',
            targetId: 's1',
            salonId: 's1',
            action: 'salon.service.create',
            createdAt: '2026-09-21T10:00:00.000Z',
            changes: [
              {
                field: 'services.svc9',
                before: null,
                after: {
                  name: 'Beard trim',
                  description: '',
                  category: 'beard_and_mustache',
                  durationMinutes: 20,
                  price: 250,
                  currency: 'MDL',
                  priceUnit: '',
                  isActive: true,
                },
              },
            ],
            reason: null,
            affected: [],
          },
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/history');

    await expect(page.getByText('Створення послуги Каталогу')).toBeVisible();
    const change = page.getByTestId('history-change');
    await expect(change).toContainText('Послуга');
    await expect(change).toContainText('Beard trim · Барберинг · 20 хв · 250 MDL');
    await expect(change).not.toContainText('{');
  });

  test('is read-only in a Видалений salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, base([service()], { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }));
    await signIn(page, ADMIN, '/salons/s1/services');

    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-new')).toHaveCount(0);
    await expect(page.getByTestId('service-edit')).toHaveCount(0);
    await expect(page.getByTestId('service-deactivate')).toHaveCount(0);
  });
});
