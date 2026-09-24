import type { Page } from '@playwright/test';
import { apiOk, holdResponse, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, goBackTo, signIn, test } from './fixtures/app.fixture';
import { expectOnlyCancellation } from './fixtures/appointment-offers';

/**
 * What every profile card does whatever its kind: it opens on the profile its address names, opens
 * anew on the next one the router hands it, and never lets the read of an earlier opening land on
 * the one shown now. And one rule every tab of it keeps: a Видалений profile — or a Майстер салону
 * whose Салон is Видалений — is only read, on every tab that could otherwise change something, but
 * for the exceptions the backend makes there, such as cancelling a Запис or taking a Майстер off the
 * Ростер.
 *
 * The late read is held by the mock and let go once the next profile is shown. The card then makes
 * a request of its own and waits for it to be drawn: by then the late read has had its chance.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const DELETED = { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' };
const NO_HISTORY = apiOk({ items: [], nextCursor: null });
const NO_REVIEWS = apiOk({ items: [], nextCursor: null });

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
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
  description: 'Barber since 2019',
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
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const salonMaster = (overrides: Record<string, unknown> = {}) => ({
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

const client = (overrides: Record<string, unknown> = {}) => ({
  clientId: 'c1',
  name: 'Maria Rusu',
  firstName: 'Maria',
  lastName: 'Rusu',
  email: 'maria@bookme.md',
  phone: '+37360000001',
  avatarUrl: '',
  language: 'uk',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: null,
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
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

const copy = (overrides: Record<string, unknown> = {}) => ({
  ...service({ durationMinutes: 45, price: 700 }),
  catalog: { durationMinutes: 30, price: 500, isActive: true },
  ...overrides,
});

const DICTIONARIES = apiOk({
  serviceCategories: ['haircut'],
  specializations: ['barber'],
  serviceCurrencies: ['MDL'],
});

const media = (overrides: Record<string, unknown> = {}) =>
  apiOk({
    avatarUrl: null,
    images: ['https://res.cloudinary.com/demo/image/upload/v1/gallery/a.jpg'],
    certificates: [
      {
        certificateId: 'cert-1',
        title: 'Диплом перукаря',
        issuer: 'Академія краси',
        issuedAt: '2024-05-01T00:00:00.000Z',
        expiresAt: null,
        credentialId: null,
        verificationUrl: null,
        notes: null,
        fileUrl: '',
        isActive: true,
        createdAt: '2024-05-02T00:00:00.000Z',
        updatedAt: '2024-05-02T00:00:00.000Z',
      },
    ],
    ...overrides,
  });

const WEEK = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: true,
  slots: [{ start: '09:00', end: '18:00' }],
}));

/** The calendar opens on the current month: the mock answers whatever window it is asked for. */
const schedule = (url: URL): MockResponse => {
  const from = url.searchParams.get('from') ?? '';
  return apiOk({
    weeklyHours: WEEK,
    schedulePattern: null,
    timeOff: [],
    appointments: [],
    todayDate: from,
    timezone: 'Europe/Chisinau',
  });
};

/** Two days ahead: a Запис still «заброньовано» that nobody has had the chance to close. */
const DAY = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

const booked = (overrides: Record<string, unknown> = {}) => ({
  appointmentId: 'a1',
  startTime: `${DAY}T06:00:00Z`,
  endTime: `${DAY}T06:45:00Z`,
  status: 'BOOKED',
  clientName: 'Maria Client',
  masterId: 'm1',
  masterName: 'Ion Popa',
  salonId: 's1',
  serviceNames: ['Haircut'],
  totalPrice: 500,
  currency: 'MDL',
  isManual: false,
  ...overrides,
});

const bookedList = (overrides: Record<string, unknown> = {}) =>
  apiOk({ timezone: 'Europe/Chisinau', items: [booked(overrides)] });

/** The card of that Запис, as the backend answers it: its Місце is the Видалений profile's. */
const bookedDetails = (overrides: Record<string, unknown> = {}) =>
  apiOk({
    ...booked(),
    updatedAt: '2026-09-20T10:00:00.000Z',
    timezone: 'Europe/Chisinau',
    clientId: 'c1',
    clientPhone: '+37360000001',
    salonName: 'Beauty Lab',
    venueStatus: 'deleted',
    services: [{ serviceId: 'svc1', name: 'Haircut', durationMinutes: 45, price: 500 }],
    totalDurationMinutes: 45,
    notes: null,
    ...overrides,
  });

const tab = (page: Page, path: string) =>
  page.locator(`a[data-testid="card-tab"][href$="/${path}"]`);

/** Opens the card's Записи tab and expands the one Запис on it. */
async function openTheAppointment(page: Page): Promise<void> {
  await tab(page, 'appointments').click();
  await page.getByTestId('appointment-row').click();
}

type Kind = {
  name: string;
  /** The first profile's address; its read is the one held. */
  first: string;
  /** The profile the card has moved on to. */
  next: string;
  nextTitle: string;
  /** The held read of the first profile. */
  heldRead: string;
  routes: (held: () => Promise<MockResponse>) => MockRoutes;
  /** A tab of the next profile that asks the backend something, and what shows it was answered. */
  settleTab: string;
  settled: string;
  /** A field of the profile tab that names the next profile. */
  field: { testId: string; text: string };
};

const KINDS: Kind[] = [
  {
    name: 'Салон',
    first: '/salons/s1/profile',
    next: '/salons/s2/profile',
    nextTitle: 'Nail Studio',
    heldRead: 'GET /admin/salons/s1',
    routes: (held) => ({
      'GET /admin/salons/s1': held,
      'GET /admin/salons/s2': apiOk(salon({ salonId: 's2', name: 'Nail Studio' })),
      'GET /admin/audit': NO_HISTORY,
    }),
    settleTab: 'history',
    settled: 'history-empty',
    field: { testId: 'field-name', text: 'Nail Studio' },
  },
  {
    name: 'Незалежний майстер',
    first: '/independent-masters/m1/profile',
    next: '/independent-masters/m2/profile',
    nextTitle: 'Olga Rusu',
    heldRead: 'GET /admin/masters/m1',
    routes: (held) => ({
      'GET /admin/masters/m1': held,
      'GET /admin/masters/m2': apiOk(master({ masterId: 'm2', name: 'Olga Rusu' })),
      'GET /admin/audit': NO_HISTORY,
    }),
    settleTab: 'history',
    settled: 'history-empty',
    field: { testId: 'field-name', text: 'Olga Rusu' },
  },
  {
    name: 'Майстер салону',
    first: '/salons/s1/masters/m1/profile',
    next: '/salons/s1/masters/m2/profile',
    nextTitle: 'Olga Rusu',
    heldRead: 'GET /admin/salons/s1/masters/m1',
    routes: (held) => ({
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m1': held,
      'GET /admin/salons/s1/masters/m2': apiOk(
        salonMaster({ masterId: 'm2', masterName: 'Olga Rusu', commissionPercent: 30 }),
      ),
      'GET /admin/reviews': NO_REVIEWS,
    }),
    settleTab: 'reviews',
    settled: 'reviews-empty',
    field: { testId: 'field-commission', text: '30%' },
  },
  {
    name: 'Клієнт',
    first: '/clients/c1/profile',
    next: '/clients/c2/profile',
    nextTitle: 'Ion Popa',
    heldRead: 'GET /admin/clients/c1',
    routes: (held) => ({
      'GET /admin/clients/c1': held,
      'GET /admin/clients/c2': apiOk(
        client({ clientId: 'c2', name: 'Ion Popa', email: 'ion@bookme.md' }),
      ),
      'GET /admin/audit': NO_HISTORY,
    }),
    settleTab: 'history',
    settled: 'history-empty',
    field: { testId: 'field-email', text: 'ion@bookme.md' },
  },
];

const FIRST_PROFILE: Record<string, unknown> = {
  'GET /admin/salons/s1': salon(),
  'GET /admin/masters/m1': master(),
  'GET /admin/salons/s1/masters/m1': salonMaster(),
  'GET /admin/clients/c1': client(),
};

test.describe('кожна картка профілю', () => {
  for (const kind of KINDS) {
    test(`${kind.name}: opens on the next profile, and the late read of the first stays out of it`, async ({
      page,
      mockBackend,
    }) => {
      const lateRead = holdResponse(apiOk(FIRST_PROFILE[kind.heldRead]));
      await mockBackend(ADMIN, { 'GET /admin/me': ME, ...kind.routes(lateRead.respond) });
      await signIn(page, ADMIN, kind.first);
      await lateRead.requested;

      await goBackTo(page, kind.next);
      await expect(page.getByTestId('card-title')).toHaveText(kind.nextTitle);
      await expect(page.getByTestId(kind.field.testId)).toHaveText(kind.field.text);

      await lateRead.release();
      await tab(page, kind.settleTab).click();
      await expect(page.getByTestId(kind.settled)).toBeVisible();
      await tab(page, 'profile').click();

      await expect(page).toHaveURL(new RegExp(`${kind.next}$`));
      await expect(page.getByTestId('card-title')).toHaveText(kind.nextTitle);
      await expect(page.getByTestId(kind.field.testId)).toHaveText(kind.field.text);
    });
  }
});

test.describe('Видалений — лише на перегляд', () => {
  test('every tab of a Видалений Салон that could change something only reads', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(DELETED)),
      // A card that is not active warns about the Записи still ahead of it.
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/salons/s1/hours': apiOk({ days: WEEK }),
      'GET /admin/dictionaries': DICTIONARIES,
      'GET /admin/salons/s1/services': apiOk({ items: [service({ masterCopyCount: 1 })] }),
      'GET /admin/salons/s1/media': media(),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('field-name')).toHaveText('Beauty Lab');
    await expect(page.getByTestId('profile-edit')).toHaveCount(0);

    await tab(page, 'hours').click();
    await expect(page.getByTestId('hours-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);

    await tab(page, 'services').click();
    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-new')).toHaveCount(0);
    await expect(page.getByTestId('service-edit')).toHaveCount(0);
    await expect(page.getByTestId('service-deactivate')).toHaveCount(0);

    await tab(page, 'media').click();
    await expect(page.getByTestId('media-photo')).toHaveCount(1);
    await expect(page.getByTestId('media-readonly-profile')).toBeVisible();
    await expect(page.getByTestId('media-photo-delete')).toHaveCount(0);
    await expect(page.getByTestId('media-certificate-delete')).toHaveCount(0);
  });

  test('a Запис of a Видалений Салон can only be cancelled', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(DELETED)),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 1 }),
      'GET /admin/salons/s1/masters': apiOk({ items: [salonMaster()] }),
      'GET /admin/salons/s1/appointments': bookedList(),
      'GET /admin/appointments/a1': bookedDetails(),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await openTheAppointment(page);
    await expectOnlyCancellation(page);
  });

  test('every tab of a Видалений Незалежний майстер that could change something only reads', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master(DELETED)),
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/masters/m1/schedule': schedule,
      'GET /admin/dictionaries': DICTIONARIES,
      'GET /admin/masters/m1/services': apiOk({ items: [service()] }),
      'GET /admin/masters/m1/media': media({
        avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/avatar/a.jpg',
      }),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('field-name')).toHaveText('Ion Popa');
    await expect(page.getByTestId('profile-edit')).toHaveCount(0);

    await tab(page, 'schedule').click();
    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);
    await expect(page.getByTestId('rotation-edit')).toHaveCount(0);
    await expect(page.getByTestId('time-off-add')).toHaveCount(0);

    await tab(page, 'services').click();
    await expect(page.getByTestId('service-row')).toHaveCount(1);
    await expect(page.getByTestId('service-new')).toHaveCount(0);
    await expect(page.getByTestId('service-edit')).toHaveCount(0);
    await expect(page.getByTestId('service-deactivate')).toHaveCount(0);

    await tab(page, 'media').click();
    await expect(page.getByTestId('media-avatar')).toBeVisible();
    await expect(page.getByTestId('media-readonly-profile')).toBeVisible();
    await expect(page.getByTestId('media-avatar-delete')).toHaveCount(0);
    await expect(page.getByTestId('media-photo-delete')).toHaveCount(0);
    await expect(page.getByTestId('media-certificate-delete')).toHaveCount(0);
  });

  test('a Запис of a Видалений Незалежний майстер can only be cancelled', async ({
    page,
    mockBackend,
  }) => {
    const independent = { salonId: null, salonName: null };
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master(DELETED)),
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 1 }),
      'GET /admin/masters/m1/appointments': bookedList(independent),
      'GET /admin/appointments/a1': bookedDetails(independent),
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await openTheAppointment(page);
    await expectOnlyCancellation(page);
  });

  test('every tab of a Майстер салону in a Видалений Салон only reads — removal from the Ростер aside', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(DELETED)),
      'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
      'GET /admin/salons/s1/masters/m1/schedule': schedule,
      'GET /admin/salons/s1/hours': apiOk({ days: WEEK }),
      'GET /admin/salons/s1/masters/m1/services': apiOk({ items: [copy()] }),
      'GET /admin/salons/s1/services': apiOk({ items: [service({ masterCopyCount: 1 })] }),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('field-commission')).toHaveText('40%');
    await expect(page.getByTestId('master-edit')).toHaveCount(0);
    // Masters get stranded in a Видалений Салон: taking them off its Ростер is still the panel's.
    await expect(page.getByTestId('master-remove')).toBeVisible();

    await tab(page, 'schedule').click();
    await expect(page.getByTestId('schedule-day')).toHaveCount(7);
    await expect(page.getByTestId('hours-edit')).toHaveCount(0);
    await expect(page.getByTestId('rotation-edit')).toHaveCount(0);
    await expect(page.getByTestId('time-off-add')).toHaveCount(0);

    await tab(page, 'services').click();
    await expect(page.getByTestId('copy-row')).toHaveCount(1);
    await expect(page.getByTestId('copy-new')).toHaveCount(0);
    await expect(page.getByTestId('copy-edit')).toHaveCount(0);
    await expect(page.getByTestId('copy-remove')).toHaveCount(0);
  });

  test('a Запис of a Майстер салону in a Видалений Салон can only be cancelled', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(DELETED)),
      'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
      'GET /admin/salons/s1/appointments': bookedList(),
      'GET /admin/appointments/a1': bookedDetails(),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await openTheAppointment(page);
    await expectOnlyCancellation(page);
  });
});
