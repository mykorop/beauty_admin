import type { Page } from '@playwright/test';
import { apiError, apiOk, holdResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, goBackTo, signIn, test } from './fixtures/app.fixture';

/**
 * Every form edited under `updatedAt` behaves the same: a save refused with `EDIT_CONFLICT` says so
 * and saves nothing more until the form is reloaded; the reload opens it on what was saved
 * meanwhile, and the next save goes under that record's `updatedAt`. A save that lands closes the
 * form and says so. A save answered after the card moved on changes nothing there.
 *
 * Each form's own suite covers what it sends and the reload itself. This one runs all five through
 * the same steps, and adds what was not covered yet: that saving stays shut until the reload, late
 * answers for the forms that were not bound to the card, and a Копія майстра removed meanwhile.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SEEN = '2026-05-02T11:30:00.000Z';
const FRESH = '2026-09-21T09:00:00.000Z';
const SAVED = 'Зміни збережено.';

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
  locationLatitude: null,
  locationLongitude: null,
  phone: '+37360000001',
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
  updatedAt: SEEN,
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
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
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
  updatedAt: SEEN,
  ...overrides,
});

const salonMaster = (overrides: Record<string, unknown> = {}) => ({
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
  joinedAt: '2026-02-01T09:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

const OLGA = { masterId: 'm3', masterName: 'Olga Rusu', email: 'olga@bookme.md' };

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
  masterCopyCount: 1,
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: SEEN,
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
  updatedAt: SEEN,
  ...overrides,
});

const DICTIONARIES = apiOk({
  serviceCategories: ['haircut', 'styling'],
  specializations: ['barber'],
  serviceCurrencies: ['MDL'],
});

/** The first read is what the form opens on; every later one is what was saved meanwhile. */
const readThenFresh = (first: unknown, fresh: unknown): MockRoutes[string] => {
  let reads = 0;
  return () => apiOk(reads++ === 0 ? first : fresh);
};

/** Refused as a lost race once, then saved. */
const conflictThenSaved = (saved: unknown): MockRoutes[string] => {
  let saves = 0;
  return () => (saves++ === 0 ? apiError(409, 'EDIT_CONFLICT') : apiOk(saved));
};

type FormCase = {
  name: string;
  path: string;
  routes: MockRoutes;
  /** The route of the save. */
  save: string;
  open: (page: Page) => Promise<void>;
  /** The form, and the one field the spec types into. */
  form: string;
  field: string;
  saveButton: string;
  /** The field's value as the form opens, and as it reads after the reload. */
  opened: string;
  fresh: string;
  /** Typed over the fresh value, and sent under the reloaded `updatedAt`: only that field. */
  retyped: string;
  resent: unknown;
};

const FORMS: FormCase[] = [
  {
    name: 'профіль Салону',
    path: '/salons/s1/profile',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': readThenFresh(
        salon(),
        salon({ bufferMinutes: 15, updatedAt: FRESH }),
      ),
      'PATCH /admin/salons/s1/profile': conflictThenSaved(
        salon({ bufferMinutes: 20, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    },
    save: 'PATCH /admin/salons/s1/profile',
    open: (page) => page.getByTestId('profile-edit').click(),
    form: 'profile-form',
    field: 'edit-bufferMinutes',
    saveButton: 'edit-save',
    opened: '10',
    fresh: '15',
    retyped: '20',
    resent: { updatedAt: FRESH, bufferMinutes: 20 },
  },
  {
    name: 'профіль Незалежного майстра',
    path: '/independent-masters/m1/profile',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': readThenFresh(
        master(),
        master({ bufferMinutes: 15, updatedAt: FRESH }),
      ),
      'PATCH /admin/masters/m1': conflictThenSaved(
        master({ bufferMinutes: 20, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    },
    save: 'PATCH /admin/masters/m1',
    open: (page) => page.getByTestId('profile-edit').click(),
    form: 'profile-form',
    field: 'edit-bufferMinutes',
    saveButton: 'edit-save',
    opened: '10',
    fresh: '15',
    retyped: '20',
    resent: { updatedAt: FRESH, bufferMinutes: 20 },
  },
  {
    name: 'Майстер салону',
    path: '/salons/s1/masters/m2/profile',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m2': readThenFresh(
        salonMaster(),
        salonMaster({ commissionPercent: 45, updatedAt: FRESH }),
      ),
      'PATCH /admin/salons/s1/masters/m2': conflictThenSaved(
        salonMaster({ commissionPercent: 50, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    },
    save: 'PATCH /admin/salons/s1/masters/m2',
    open: (page) => page.getByTestId('master-edit').click(),
    form: 'master-form',
    field: 'edit-commissionPercent',
    saveButton: 'edit-save',
    opened: '40',
    fresh: '45',
    retyped: '50',
    resent: { updatedAt: FRESH, commissionPercent: 50 },
  },
  {
    name: 'позиція Каталогу послуг',
    path: '/salons/s1/services',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/dictionaries': DICTIONARIES,
      'GET /admin/salons/s1/services': apiOk({ items: [service()] }),
      'GET /admin/salons/s1/services/svc1': apiOk(service({ price: 550, updatedAt: FRESH })),
      'PATCH /admin/salons/s1/services/svc1': conflictThenSaved(
        service({ price: 600, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    },
    save: 'PATCH /admin/salons/s1/services/svc1',
    open: (page) => page.getByTestId('service-edit').click(),
    form: 'service-form',
    field: 'service-price',
    saveButton: 'service-save',
    opened: '500',
    fresh: '550',
    retyped: '600',
    resent: { updatedAt: FRESH, price: 600 },
  },
  {
    name: 'Копія майстра',
    path: '/salons/s1/masters/m2/services',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m2': apiOk(salonMaster()),
      'GET /admin/salons/s1/services': apiOk({ items: [service()] }),
      'GET /admin/salons/s1/masters/m2/services': readThenFresh(
        { items: [copy()] },
        { items: [copy({ price: 750, updatedAt: FRESH })] },
      ),
      'PATCH /admin/salons/s1/masters/m2/services/svc1': conflictThenSaved(
        copy({ price: 800, updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    },
    save: 'PATCH /admin/salons/s1/masters/m2/services/svc1',
    open: (page) => page.getByTestId('copy-edit').click(),
    form: 'copy-form',
    field: 'copy-price',
    saveButton: 'copy-save',
    opened: '700',
    fresh: '750',
    retyped: '800',
    resent: { updatedAt: FRESH, price: 800 },
  },
];

test.describe('конкурентна правка', () => {
  for (const form of FORMS) {
    test(`${form.name}: a conflict saves nothing until the form is reloaded on the fresh record`, async ({
      page,
      mockBackend,
    }) => {
      const mock = await mockBackend(ADMIN, form.routes);
      await signIn(page, ADMIN, form.path);
      const field = page.getByTestId(form.field);
      const save = page.getByTestId(form.saveButton);

      await form.open(page);
      await expect(field).toHaveValue(form.opened);
      await expect(save).toBeDisabled();
      await field.fill('90');
      await save.click();

      await expect(page.getByTestId('edit-conflict')).toBeVisible();
      await expect(field).toHaveValue('90');
      await expect(save).toBeDisabled();
      // Typing more does not open it again: only the reload does.
      await field.fill('95');
      await expect(save).toBeDisabled();

      await page.getByTestId('edit-reload').click();

      await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
      await expect(field).toHaveValue(form.fresh);
      await expect(save).toBeDisabled();

      await field.fill(form.retyped);
      await save.click();

      await expect(page.getByTestId(form.form)).toHaveCount(0);
      await expect(page.getByText(SAVED)).toBeVisible();
      expect(mock.bodies[form.save]?.[1]).toEqual(form.resent);
    });
  }
});

const tab = (page: Page, path: string) =>
  page.locator(`a[data-testid="card-tab"][href$="/${path}"]`);

test.describe('конкурентна правка, answered after the card moved on', () => {
  test('a Каталог save of one Салон neither closes the next Салон’s form nor lands in its Каталог', async ({
    page,
    mockBackend,
  }) => {
    const lateSave = holdResponse(apiOk(service({ price: 600, updatedAt: FRESH })));
    const manicure = service({ serviceId: 'svc9', name: 'Manicure', price: 300 });
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon({ salonId: 's2', name: 'Nail Studio' })),
      'GET /admin/dictionaries': DICTIONARIES,
      'GET /admin/salons/s1/services': apiOk({ items: [service()] }),
      'GET /admin/salons/s2/services': apiOk({ items: [manicure] }),
      'PATCH /admin/salons/s1/services/svc1': lateSave.respond,
      'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/salons/s1/services');

    await page.getByTestId('service-edit').click();
    await page.getByTestId('service-price').fill('600');
    await page.getByTestId('service-save').click();
    await lateSave.requested;

    await goBackTo(page, '/salons/s2/services');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    // The form was the last Салон's; this one opens on its table, and on its own form.
    await expect(page.getByTestId('service-form')).toHaveCount(0);
    await page.getByTestId('service-edit').click();
    await page.getByTestId('service-price').fill('350');

    await lateSave.release();
    // A read of this card's own, drawn after the late answer had its chance. A toast would still
    // be up then — counted at once, since waiting for none would only wait it out.
    await tab(page, 'history').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    expect(await page.getByText(SAVED).count()).toBe(0);
    await tab(page, 'services').click();

    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-row-name')).toHaveText('Manicure');
    await expect(page.getByTestId('service-row-price')).toContainText('300');
  });

  test('a Копія save of one Майстер салону neither closes the next one’s form nor lands in his Копії', async ({
    page,
    mockBackend,
  }) => {
    const lateSave = holdResponse(apiOk(copy({ price: 800, updatedAt: FRESH })));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m2': apiOk(salonMaster()),
      'GET /admin/salons/s1/masters/m3': apiOk(salonMaster(OLGA)),
      'GET /admin/salons/s1/services': apiOk({ items: [service()] }),
      'GET /admin/salons/s1/masters/m2/services': apiOk({ items: [copy()] }),
      'GET /admin/salons/s1/masters/m3/services': apiOk({ items: [copy({ price: 650 })] }),
      'PATCH /admin/salons/s1/masters/m2/services/svc1': lateSave.respond,
      'GET /admin/reviews': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/services');

    await page.getByTestId('copy-edit').click();
    await page.getByTestId('copy-price').fill('800');
    await page.getByTestId('copy-save').click();
    await lateSave.requested;

    await goBackTo(page, '/salons/s1/masters/m3/services');
    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
    await expect(page.getByTestId('copy-form')).toHaveCount(0);
    await page.getByTestId('copy-edit').click();
    await expect(page.getByTestId('copy-price')).toHaveValue('650');
    await page.getByTestId('copy-price').fill('680');

    await lateSave.release();
    // This Майстер's own form is still open, as typed.
    await expect(page.getByTestId('copy-form')).toBeVisible();
    await expect(page.getByTestId('copy-price')).toHaveValue('680');
    await page.getByTestId('copy-cancel').click();
    await tab(page, 'reviews').click();
    await expect(page.getByTestId('reviews-empty')).toBeVisible();
    expect(await page.getByText(SAVED).count()).toBe(0);
    await tab(page, 'services').click();

    await expect(page.getByTestId('copy-row-price')).toContainText('650 MDL');
  });
});

test.describe('Копія майстра removed meanwhile', () => {
  const routes = (extra: MockRoutes): MockRoutes => ({
    'GET /admin/me': ME,
    'GET /admin/salons/s1': apiOk(salon()),
    'GET /admin/salons/s1/masters/m2': apiOk(salonMaster()),
    'GET /admin/salons/s1/services': apiOk({ items: [service()] }),
    ...extra,
  });

  test('a save refused as NOT_FOUND closes the form, drops the row and says so', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({
        'GET /admin/salons/s1/masters/m2/services': apiOk({ items: [copy()] }),
        'PATCH /admin/salons/s1/masters/m2/services/svc1': apiError(404, 'NOT_FOUND'),
      }),
    );
    await signIn(page, ADMIN, '/salons/s1/masters/m2/services');

    await page.getByTestId('copy-edit').click();
    await page.getByTestId('copy-price').fill('800');
    await page.getByTestId('copy-save').click();

    await expect(page.getByTestId('copy-form')).toHaveCount(0);
    await expect(page.getByTestId('copies-empty')).toBeVisible();
    await expect(page.getByText('Не знайдено.')).toBeVisible();
    expect(await page.getByText(SAVED).count()).toBe(0);
  });

  test('a reload that no longer finds it closes the form, drops the row and says so', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({
        'GET /admin/salons/s1/masters/m2/services': readThenFresh(
          { items: [copy()] },
          { items: [] },
        ),
        'PATCH /admin/salons/s1/masters/m2/services/svc1': apiError(409, 'EDIT_CONFLICT'),
      }),
    );
    await signIn(page, ADMIN, '/salons/s1/masters/m2/services');

    await page.getByTestId('copy-edit').click();
    await page.getByTestId('copy-price').fill('800');
    await page.getByTestId('copy-save').click();
    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();

    await expect(page.getByTestId('copy-form')).toHaveCount(0);
    await expect(page.getByTestId('copies-empty')).toBeVisible();
    await expect(page.getByText('Не знайдено.')).toBeVisible();
  });
});
