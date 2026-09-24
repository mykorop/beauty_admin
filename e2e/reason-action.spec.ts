import type { Page } from '@playwright/test';
import {
  apiError,
  apiOk,
  holdResponse,
  type MockResponse,
  type MockRoutes,
} from './fixtures/api-mock';
import { ADMIN, expect, goBackTo, signIn, test } from './fixtures/app.fixture';

/**
 * Every «дія з причиною» behaves the same, whatever it acts on: while it is on its way nothing can
 * confirm it again and nothing closes its dialog; the backend agreeing closes the dialog, says so
 * where the action has words for it, and the screen shows the answer at once; a refusal leaves the
 * dialog open with the reason as typed, to be corrected and sent again.
 *
 * Each action's own suite covers what it sends and most refusals. This one runs every action
 * through the same steps, and adds what is theirs alone to cover: an answer held by the mock and let
 * go at a chosen moment, and the refusals no suite had yet.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const BLOCKED = { status: 'blocked', blockedAt: '2026-09-22T08:00:00.000Z', blockedReason: 'Spam' };

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

const NAIL_STUDIO = { salonId: 's2', name: 'Nail Studio', ownerName: 'Olga Rusu' };

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
  updatedAt: '2026-05-02T11:30:00.000Z',
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
  updatedAt: '2026-05-02T11:30:00.000Z',
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

/** Two days ahead, so no Запис is in the past while a spec runs. */
const DAY = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

const appointment = (overrides: Record<string, unknown> = {}) => ({
  appointmentId: 'a1',
  startTime: `${DAY}T06:00:00Z`,
  endTime: `${DAY}T06:45:00Z`,
  status: 'BOOKED',
  clientName: 'Maria Client',
  masterId: 'm2',
  masterName: 'Ion Popa',
  salonId: 's1',
  serviceNames: ['Стрижка'],
  totalPrice: 350,
  currency: 'MDL',
  isManual: false,
  ...overrides,
});

const details = (overrides: Record<string, unknown> = {}) => ({
  ...appointment(),
  updatedAt: '2026-09-20T10:00:00.000Z',
  timezone: 'Europe/Chisinau',
  clientId: 'c1',
  clientPhone: '+37360000001',
  salonName: 'Beauty Lab',
  venueStatus: 'active',
  services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
  totalDurationMinutes: 45,
  notes: null,
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  reviewId: 'r1',
  appointmentId: 'appt-1',
  clientId: 'client-1',
  clientName: 'Maria Client',
  masterId: 'm1',
  salonId: 's1',
  masterRating: 1,
  salonRating: 2,
  comment: 'Rude and late',
  createdAt: '2026-09-21T10:00:00.000Z',
  hiddenAt: null,
  hiddenReason: null,
  ...overrides,
});
const HIDDEN = { hiddenAt: '2026-09-22T09:00:00.000Z', hiddenReason: 'Образи' };

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/salon_images/s1/gallery/a.jpg';
const OTHER_PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/salon_images/s1/gallery/b.jpg';
const media = (images: string[]) => ({ avatarUrl: null, images, certificates: [] });

const salonCardRoutes = (overrides: Record<string, unknown> = {}, count = 0): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon(overrides)),
  'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count }),
});

const appointmentRoutes = (): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon()),
  'GET /admin/salons/s1/masters': apiOk({ items: [salonMaster()] }),
  'GET /admin/salons/s1/appointments': apiOk({
    timezone: 'Europe/Chisinau',
    items: [appointment()],
  }),
  'GET /admin/appointments/a1': apiOk(details()),
});

const reviewRoutes = (hidden: boolean): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons': apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: [] }),
  'GET /admin/masters': apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: [] }),
  'GET /admin/reviews': apiOk({ items: [review(hidden ? HIDDEN : {})], nextCursor: null }),
});

const openAppointment = async (page: Page, status: string): Promise<void> => {
  await page.getByTestId('appointment-row').first().click();
  await page.getByTestId(`appointment-action-${status}`).click();
};

type ReasonActionCase = {
  /** What the action is, as the spec names it. */
  name: string;
  path: string;
  routes: MockRoutes;
  /** The route of the action itself. */
  action: string;
  answer: MockResponse;
  open: (page: Page) => Promise<void>;
  reason: string;
  /** How the success is told, for the actions that tell it. */
  toast?: string;
  /** What the answer changed on screen. */
  landed: (page: Page) => Promise<void>;
  /** A refusal no other suite covers for this action yet, and what it left alone. */
  refusal?: { answer: MockResponse; worded: string; untouched: (page: Page) => Promise<void> };
};

const status = (text: string) => async (page: Page) =>
  expect(page.getByTestId('card-status')).toHaveText(text);

const CASES: ReasonActionCase[] = [
  {
    name: 'Блокування Салону',
    path: '/salons/s1/profile',
    routes: salonCardRoutes(),
    action: 'POST /admin/salons/s1/block',
    answer: apiOk(salon(BLOCKED)),
    open: (page) => page.getByTestId('block-open').click(),
    reason: 'Spam',
    toast: 'Профіль заблоковано.',
    landed: status('Заблокований'),
  },
  {
    name: 'Блокування Незалежного майстра',
    path: '/independent-masters/m1/profile',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      'GET /admin/masters/m1/appointments/upcoming-count': apiOk({ count: 0 }),
    },
    action: 'POST /admin/masters/m1/block',
    answer: apiOk(master(BLOCKED)),
    open: (page) => page.getByTestId('block-open').click(),
    reason: 'Spam',
    toast: 'Профіль заблоковано.',
    landed: status('Заблокований'),
    refusal: {
      answer: apiError(409, 'PROFILE_ALREADY_BLOCKED'),
      worded: 'Профіль уже заблоковано. Оновіть сторінку.',
      untouched: status('Активний'),
    },
  },
  {
    name: 'зняття Блокування Клієнта',
    path: '/clients/c1/profile',
    routes: { 'GET /admin/me': ME, 'GET /admin/clients/c1': apiOk(client(BLOCKED)) },
    action: 'POST /admin/clients/c1/unblock',
    answer: apiOk(client()),
    open: (page) => page.getByTestId('block-open').click(),
    reason: 'Documents received',
    toast: 'Блокування знято.',
    landed: status('Активний'),
    refusal: {
      answer: apiError(409, 'PROFILE_NOT_BLOCKED'),
      worded: 'Профіль не заблоковано. Оновіть сторінку.',
      untouched: status('Заблокований'),
    },
  },
  {
    name: 'Масове скасування',
    path: '/salons/s1/profile',
    routes: salonCardRoutes(BLOCKED, 3),
    action: 'POST /admin/salons/s1/appointments/cancel-upcoming',
    answer: apiOk({ cancelled: 3, failed: 0, remaining: 0 }),
    open: (page) => page.getByTestId('upcoming-cancel-open').click(),
    reason: 'Салон заблоковано',
    toast: 'Скасовано Записів: 3.',
    landed: (page) => expect(page.getByTestId('card-upcoming-banner')).toHaveCount(0),
  },
  {
    name: 'скасування Запису',
    path: '/salons/s1/appointments',
    routes: appointmentRoutes(),
    action: 'PATCH /admin/appointments/a1',
    answer: apiOk(details({ status: 'CANCELLED' })),
    open: (page) => openAppointment(page, 'CANCELLED'),
    reason: 'Салон не відповідає',
    landed: (page) => expect(page.getByTestId('appointment-row-status')).toHaveText('Скасовано'),
  },
  {
    name: '«завершено» для Запису',
    path: '/salons/s1/appointments',
    routes: appointmentRoutes(),
    action: 'PATCH /admin/appointments/a1',
    answer: apiOk(details({ status: 'COMPLETED' })),
    open: (page) => openAppointment(page, 'COMPLETED'),
    reason: 'Клієнт прийшов із запізненням',
    landed: (page) => expect(page.getByTestId('appointment-row-status')).toHaveText('Завершено'),
    refusal: {
      answer: apiError(409, 'EDIT_CONFLICT'),
      worded: 'Дані змінились. Перезавантажте форму й спробуйте ще раз.',
      untouched: (page) =>
        expect(page.getByTestId('appointment-row-status')).toHaveText('Заброньовано'),
    },
  },
  {
    name: 'приховання Відгуку',
    path: '/reviews?salonId=s1',
    routes: reviewRoutes(false),
    action: 'POST /admin/reviews/r1/hide',
    answer: apiOk(review(HIDDEN)),
    open: (page) => page.getByTestId('review-hide').click(),
    reason: 'Образи',
    landed: (page) => expect(page.getByTestId('review-state')).toHaveText('Прихований'),
  },
  {
    name: 'повернення Відгуку',
    path: '/reviews?salonId=s1',
    routes: reviewRoutes(true),
    action: 'POST /admin/reviews/r1/unhide',
    answer: apiOk(review()),
    open: (page) => page.getByTestId('review-unhide').click(),
    reason: 'Помилково приховано',
    landed: (page) => expect(page.getByTestId('review-state')).toHaveText('Видимий'),
    refusal: {
      answer: apiError(409, 'REVIEW_NOT_HIDDEN'),
      worded: 'Відгук не приховано. Оновіть сторінку.',
      untouched: (page) => expect(page.getByTestId('review-state')).toHaveText('Прихований'),
    },
  },
  {
    name: 'Видалення вмісту',
    path: '/salons/s1/media',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/media': apiOk(media([PHOTO, OTHER_PHOTO])),
    },
    action: 'DELETE /admin/salons/s1/images',
    answer: apiOk(media([OTHER_PHOTO])),
    open: (page) => page.getByTestId('media-photo-delete').first().click(),
    reason: 'Порушує правила платформи',
    landed: (page) => expect(page.getByTestId('media-photo')).toHaveCount(1),
  },
  {
    name: 'вилучення з Ростеру',
    path: '/salons/s1/masters/m2/profile',
    routes: {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m2': apiOk(salonMaster()),
    },
    action: 'DELETE /admin/salons/s1/masters/m2',
    answer: apiOk({ removed: true, masterId: 'm2', status: 'INACTIVE' }),
    open: (page) => page.getByTestId('master-remove').click(),
    reason: 'Salon closed',
    toast: 'Майстра вилучено з Ростеру.',
    landed: status('Співпрацю завершено'),
  },
];

test.describe('дія з причиною', () => {
  for (const action of CASES) {
    test(`${action.name}: busy while on its way, then closed and shown`, async ({
      page,
      mockBackend,
    }) => {
      const held = holdResponse(action.answer);
      const mock = await mockBackend(ADMIN, { ...action.routes, [action.action]: held.respond });
      await signIn(page, ADMIN, action.path);

      await action.open(page);
      await page.getByTestId('reason-input').fill(action.reason);
      await page.getByTestId('reason-confirm').click();
      await held.requested;

      // On its way: it cannot be confirmed again, and neither a button nor Escape closes it.
      await expect(page.getByTestId('reason-confirm')).toBeDisabled();
      await expect(page.getByTestId('reason-cancel')).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('reason-dialog')).toBeVisible();
      await expect(page.getByTestId('reason-input')).toHaveValue(action.reason);

      await held.release();

      await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
      if (action.toast) {
        await expect(page.getByText(action.toast)).toBeVisible();
      }
      await action.landed(page);
      expect(mock.bodies[action.action]).toHaveLength(1);
    });

    const refusal = action.refusal;
    if (refusal) {
      test(`${action.name}: stays open with the reason as typed when refused`, async ({
        page,
        mockBackend,
      }) => {
        await mockBackend(ADMIN, { ...action.routes, [action.action]: refusal.answer });
        await signIn(page, ADMIN, action.path);

        await action.open(page);
        await page.getByTestId('reason-input').fill(action.reason);
        await page.getByTestId('reason-confirm').click();

        await expect(page.getByText(refusal.worded)).toBeVisible();
        await expect(page.getByTestId('reason-dialog')).toBeVisible();
        await expect(page.getByTestId('reason-input')).toHaveValue(action.reason);
        // Ready to be sent again, as typed.
        await expect(page.getByTestId('reason-confirm')).toBeEnabled();
        await refusal.untouched(page);
      });
    }
  }
});

test.describe('дія з причиною, answered after the card moved on', () => {
  test('a Видалення вмісту leaves the next Салон’s content and its dialog alone', async ({
    page,
    mockBackend,
  }) => {
    const lateRemoval = holdResponse(apiOk(media([OTHER_PHOTO])));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/salons/s1/media': apiOk(media([PHOTO, OTHER_PHOTO])),
      'GET /admin/salons/s2/media': apiOk(media([PHOTO, OTHER_PHOTO])),
      'DELETE /admin/salons/s1/images': lateRemoval.respond,
      'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/salons/s1/media');

    await page.getByTestId('media-photo-delete').first().click();
    await page.getByTestId('reason-input').fill('Порушує правила платформи');
    await page.getByTestId('reason-confirm').click();
    await lateRemoval.requested;

    await goBackTo(page, '/salons/s2/media');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(page.getByTestId('media-photo')).toHaveCount(2);
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    // This Салон's own confirmation, open while the late answer lands.
    await page.getByTestId('media-photo-delete').first().click();
    await page.getByTestId('reason-input').fill('Інша причина');

    await lateRemoval.release();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Інша причина');
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-cancel').click();
    // A read of this card's own, drawn after the late answer had its chance.
    await page.locator('a[data-testid="card-tab"][href$="/history"]').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    await page.locator('a[data-testid="card-tab"][href$="/media"]').click();
    await expect(page.getByTestId('media-photo')).toHaveCount(2);
  });

  test('a Масове скасування tells the next Салон nothing and leaves its count alone', async ({
    page,
    mockBackend,
  }) => {
    const lateRun = holdResponse(apiOk({ cancelled: 3, failed: 0, remaining: 0 }));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon(BLOCKED)),
      'GET /admin/salons/s2': apiOk(salon({ ...NAIL_STUDIO, ...BLOCKED })),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 3 }),
      'GET /admin/salons/s2/appointments/upcoming-count': apiOk({ count: 2 }),
      'POST /admin/salons/s1/appointments/cancel-upcoming': lateRun.respond,
      'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('upcoming-cancel-open').click();
    await page.getByTestId('reason-input').fill('Салон заблоковано');
    await page.getByTestId('reason-confirm').click();
    await lateRun.requested;

    await goBackTo(page, '/salons/s2/profile');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(page.getByTestId('card-upcoming-count')).toContainText('2');
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);

    await lateRun.release();
    // A read of this card's own, drawn after the late answer had its chance. A toast would still
    // be up then — counted at once, since waiting for none would only wait it out.
    await page.locator('a[data-testid="card-tab"][href$="/history"]').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    expect(await page.getByText('Скасовано Записів: 3.').count()).toBe(0);
    await expect(page.getByTestId('card-upcoming-count')).toContainText('2');
    await expect(page.getByTestId('upcoming-cancel-open')).toBeEnabled();
  });
});
