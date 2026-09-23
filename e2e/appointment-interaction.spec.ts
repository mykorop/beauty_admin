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
 * One Запис open at a time in a list of Записи, and every answer about a Запис landing where it
 * belongs while the list moves on under it: another Запис opened, the open one closed, the filters
 * or the target changed, a new day gathered.
 *
 * A details read belongs to the opening that asked for it. An action's answer belongs to the list
 * it was taken in: its row takes it even when the row has been closed since, but it never fills
 * another Запис's details, never reopens a closed one and never reaches a list read since. A page
 * appended to a list, or a poll that hands the same gathered day back, is still that list.
 *
 * The Салон's tab carries the whole matrix. The Незалежний майстер's and the Майстер салону's each
 * prove their own wiring with one case. A Клієнт's history and the platform's list — a gathered day
 * or a narrowed window — each carry the cases their own reading adds: an older page, the Клієнт
 * changing, polls of a gathering, a failed or a new one.
 *
 * Every late answer is held by the mock and let go at a chosen moment. Where a spec has to show
 * that a late answer changed nothing, the page makes a request of its own after it and waits for
 * that one to be drawn — the Блокування dialog states the upcoming count, the Клієнт's history
 * draws an older page, the day is polled again: by then the late answer has had its chance.
 */

test.use({ timezoneId: 'America/Los_Angeles' });

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SALON_TAB = '/salons/s1/appointments';
const SALON_LIST = 'GET /admin/salons/s1/appointments';
const SALON_UPCOMING = 'GET /admin/salons/s1/appointments/upcoming-count';
const DETAILS_A1 = 'GET /admin/appointments/a1';
const DETAILS_A2 = 'GET /admin/appointments/a2';
const STATUS_A1 = 'PATCH /admin/appointments/a1';

/** Two days ahead: the day is stable while a spec runs, and «у минулому» decides nothing. */
const DAY = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
/** The clock the card showed — the one every action sends back. */
const SEEN = '2026-09-20T10:00:00.000Z';

const salon = {
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
  bufferMinutes: 0,
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
};

const independentMaster = {
  masterId: 'm1',
  name: 'Ana Rusu',
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
  phone: '+37360000009',
  email: 'ana@bookme.md',
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
};

const rosterMaster = {
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

/** Maria at 09:00, Elena at 11:00 and Olga at 13:00 in Chișinău — «заброньовано» unless said. */
const CLIENTS = { a1: 'Maria Client', a2: 'Elena Client', a3: 'Olga Client' } as const;
const HOURS = { a1: '06', a2: '08', a3: '10' } as const;

const appointment = (id: keyof typeof CLIENTS, overrides: Record<string, unknown> = {}) => ({
  appointmentId: id,
  startTime: `${DAY}T${HOURS[id]}:00:00Z`,
  endTime: `${DAY}T${HOURS[id]}:45:00Z`,
  status: 'BOOKED',
  clientName: CLIENTS[id],
  masterId: 'm2',
  masterName: 'Ion Popa',
  salonId: 's1',
  serviceNames: ['Стрижка'],
  totalPrice: 350,
  currency: 'MDL',
  isManual: false,
  ...overrides,
});

const details = (id: keyof typeof CLIENTS, overrides: Record<string, unknown> = {}) => ({
  ...appointment(id),
  updatedAt: SEEN,
  timezone: 'Europe/Chisinau',
  clientId: `client-${id}`,
  clientPhone: '+37360000001',
  salonName: 'Beauty Lab',
  services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
  totalDurationMinutes: 45,
  notes: null,
  ...overrides,
});

const listOf = (items: unknown[]): MockResponse => apiOk({ timezone: 'Europe/Chisinau', items });

const salonRoutes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon),
  'GET /admin/salons/s1/masters': apiOk({ items: [rosterMaster] }),
  [SALON_LIST]: listOf([appointment('a1'), appointment('a2')]),
  [DETAILS_A1]: apiOk(details('a1')),
  [DETAILS_A2]: apiOk(details('a2')),
  [SALON_UPCOMING]: apiOk({ count: 2 }),
  ...extra,
});

const rows = (page: Page) => page.getByTestId('appointment-row');
const opened = (page: Page) => page.getByTestId('appointment-details');

async function expectOpen(page: Page, index: number | null): Promise<void> {
  const toggles = rows(page).getByTestId('appointment-row-toggle');
  const count = await toggles.count();
  for (let i = 0; i < count; i++) {
    await expect(toggles.nth(i)).toHaveAttribute('aria-expanded', String(i === index));
  }
  await expect(opened(page)).toHaveCount(index === null ? 0 : 1);
}

/** Asks to cancel the open Запис, with a reason, and confirms. */
async function cancelOpened(page: Page): Promise<void> {
  await page.getByTestId('appointment-action-CANCELLED').click();
  await page.getByTestId('reason-input').fill('Клієнт попросив');
  await page.getByTestId('reason-confirm').click();
}

/**
 * The card's own round trip: the Блокування dialog asks for the upcoming count and states it. A
 * late answer let go before this has been drawn by the time it is. Once per spec — the card reads
 * the count only once.
 */
async function cardRoundTrip(page: Page): Promise<void> {
  await page.getByTestId('block-open').click();
  await expect(page.getByTestId('block-upcoming')).toContainText('2');
  await page.getByTestId('reason-cancel').click();
  await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
}

test.describe('Записи Салону', () => {
  const lateReads = [
    {
      title: 'details answered after another Запис was opened stay out of it',
      answer: apiOk(details('a1', { notes: 'Про Марію' })),
    },
    {
      title: 'a failure answered after another Запис was opened stays out of it',
      answer: apiError(404, 'NOT_FOUND'),
    },
  ];
  for (const { title, answer } of lateReads) {
    test(title, async ({ page, mockBackend }) => {
      const late = holdResponse(answer);
      const next = holdResponse(apiOk(details('a2')));
      await mockBackend(
        ADMIN,
        salonRoutes({ [DETAILS_A1]: late.respond, [DETAILS_A2]: next.respond }),
      );
      await signIn(page, ADMIN, SALON_TAB);

      await rows(page).nth(0).click();
      await late.requested;
      await rows(page).nth(1).click();
      await next.requested;

      // The next Запис is still being read when the last one's answer lands.
      await late.release();
      await cardRoundTrip(page);

      await expectOpen(page, 1);
      await expect(opened(page).getByTestId('appointment-details-loading')).toBeVisible();
      await expect(opened(page).getByTestId('appointment-details-failed')).toHaveCount(0);

      await next.release();
      await expect(opened(page).getByTestId('appointment-details-client')).toHaveText(
        'Elena Client',
      );
      await expect(opened(page).getByTestId('appointment-details-notes')).not.toContainText(
        'Марію',
      );
      await expectOpen(page, 1);
    });
  }

  test('a Запис closed before its details answer stays closed', async ({ page, mockBackend }) => {
    const lateFailure = holdResponse(apiError(404, 'NOT_FOUND'));
    await mockBackend(ADMIN, salonRoutes({ [DETAILS_A1]: lateFailure.respond }));
    await signIn(page, ADMIN, SALON_TAB);

    await rows(page).nth(0).click();
    await lateFailure.requested;
    await rows(page).nth(0).click();
    await expectOpen(page, null);

    await lateFailure.release();
    await cardRoundTrip(page);

    await expectOpen(page, null);
  });

  test('a failed read is its own opening’s: the next one loads afresh, and so does a retry', async ({
    page,
    mockBackend,
  }) => {
    const slowNext = holdResponse(apiOk(details('a2')));
    let reads = 0;
    await mockBackend(
      ADMIN,
      salonRoutes({
        [DETAILS_A1]: () =>
          reads++ === 0 ? apiError(500, 'INTERNAL_ERROR') : apiOk(details('a1')),
        [DETAILS_A2]: slowNext.respond,
      }),
    );
    await signIn(page, ADMIN, SALON_TAB);

    await rows(page).nth(0).click();
    await expect(opened(page).getByTestId('appointment-details-failed')).toBeVisible();

    await rows(page).nth(1).click();
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-loading')).toBeVisible();
    await expect(opened(page).getByTestId('appointment-details-failed')).toHaveCount(0);
    await slowNext.release();
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await rows(page).nth(0).click();
    await expectOpen(page, 0);
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Maria Client');
    await expect(opened(page).getByTestId('appointment-details-failed')).toHaveCount(0);
  });

  test('an action under a «заброньовано» filter redraws its row and its details, and the row stays', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf([appointment('a1'), appointment('a2')]);
        },
        [STATUS_A1]: apiOk(details('a1', { status: 'CANCELLED' })),
      }),
    );
    await signIn(page, ADMIN, `${SALON_TAB}?status=BOOKED`);

    await rows(page).nth(0).click();
    await cancelOpened(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-actions-closed')).toBeVisible();
    // Absorbed, not re-read: under this filter a re-read would drop the row from under its card.
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, 0);
    expect(asked.map((params) => params.get('status'))).toEqual(['BOOKED']);
  });

  test('an action answered after another Запис was opened redraws its own row, not the open details', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    const mock = await mockBackend(ADMIN, salonRoutes({ [STATUS_A1]: lateCancel.respond }));
    await signIn(page, ADMIN, SALON_TAB);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    // The confirmation's mask keeps a pointer off the list while the action is under way. The list
    // must not lean on that, so the other row is clicked through the page itself.
    await rows(page).nth(1).dispatchEvent('click');
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');
    await expect(opened(page).getByTestId('appointment-actions')).toBeVisible();
    await expect(rows(page).nth(1).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
    expect(mock.bodies[STATUS_A1]).toEqual([
      { status: 'CANCELLED', updatedAt: SEEN, reason: 'Клієнт попросив' },
    ]);
  });

  test('an action answered after its Запис was closed redraws the row without reopening it', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(ADMIN, salonRoutes({ [STATUS_A1]: lateCancel.respond }));
    await signIn(page, ADMIN, SALON_TAB);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    // Past the confirmation's mask, as above.
    await rows(page).nth(0).dispatchEvent('click');
    await expectOpen(page, null);

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expectOpen(page, null);
  });

  test('an action answered after its Запис was reopened lands in its row and its details alike', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(ADMIN, salonRoutes({ [STATUS_A1]: lateCancel.respond }));
    await signIn(page, ADMIN, SALON_TAB);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    // Past the confirmation's mask, as above: closed, and opened again before the answer.
    await rows(page).nth(0).dispatchEvent('click');
    await rows(page).nth(0).dispatchEvent('click');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-actions-closed')).toBeVisible();
    await expectOpen(page, 0);
  });

  test('an action answered after the filters changed leaves the list read since as it was read', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      salonRoutes({
        [SALON_LIST]: (url) =>
          listOf(
            url.searchParams.has('status')
              ? [appointment('a1'), appointment('a2')]
              : [appointment('a1'), appointment('a2'), appointment('a3', { status: 'COMPLETED' })],
          ),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, `${SALON_TAB}?status=BOOKED`);
    await expect(page).toHaveURL(/from=.*status=BOOKED/);
    const window = new URL(page.url()).searchParams;

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    // Back to the same window with no status filter: a list of its own.
    await goBackTo(page, `${SALON_TAB}?from=${window.get('from')}&to=${window.get('to')}`);
    await expect(rows(page)).toHaveCount(3);
    await expectOpen(page, null);

    await lateCancel.release();
    await cardRoundTrip(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
    await expectOpen(page, null);
  });
});

test.describe('Записи Незалежного майстра', () => {
  test('an action answered after another Запис was opened redraws its own row only', async ({
    page,
    mockBackend,
  }) => {
    const own = { masterId: 'm1', masterName: 'Ana Rusu', salonId: null };
    const lateCancel = holdResponse(
      apiOk(details('a1', { ...own, salonName: null, status: 'CANCELLED' })),
    );
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(independentMaster),
      'GET /admin/masters/m1/appointments': listOf([
        appointment('a1', own),
        appointment('a2', own),
      ]),
      [DETAILS_A1]: apiOk(details('a1', { ...own, salonName: null })),
      [DETAILS_A2]: apiOk(details('a2', { ...own, salonName: null })),
      [STATUS_A1]: lateCancel.respond,
    });
    await signIn(page, ADMIN, '/independent-masters/m1/appointments');

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;
    // Past the confirmation's mask, as on the Салон's tab.
    await rows(page).nth(1).dispatchEvent('click');
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');
    await expect(opened(page).getByTestId('appointment-details-salon')).toHaveText(
      'Незалежний майстер',
    );
  });
});

test.describe('Записи Майстра салону', () => {
  test('an action under a «заброньовано» filter redraws his row and its details, and the row stays', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      salonRoutes({
        'GET /admin/salons/s1/masters/m2': apiOk(rosterMaster),
        [SALON_LIST]: (url) => {
          asked.push(url.searchParams);
          return listOf([appointment('a1'), appointment('a2')]);
        },
        [STATUS_A1]: apiOk(details('a1', { status: 'NO_SHOW' })),
      }),
    );
    await signIn(page, ADMIN, '/salons/s1/masters/m2/appointments?status=BOOKED');

    await rows(page).nth(0).click();
    await page.getByTestId('appointment-action-NO_SHOW').click();
    await page.getByTestId('reason-confirm').click();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Не з’явився');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Не з’явився');
    await expect(rows(page)).toHaveCount(2);
    expect(asked.map((params) => [params.get('status'), params.get('masterId')])).toEqual([
      ['BOOKED', 'm2'],
    ]);
  });
});

const CLIENT_TAB = '/clients/c1/appointments';
const CLIENT_FEED = 'GET /admin/clients/c1/appointments';

const clientProfile = (clientId: string, name: string) => ({
  clientId,
  name,
  firstName: name.split(' ')[0],
  lastName: name.split(' ')[1],
  email: `${clientId}@bookme.md`,
  phone: '+37360000001',
  avatarUrl: '',
  language: 'uk',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
});

/** A row of a list that spans venues: the venue and its clock travel on the row. */
const venueRow = (id: keyof typeof CLIENTS, overrides: Record<string, unknown> = {}) =>
  appointment(id, { venueName: 'Beauty Lab', timezone: 'Europe/Chisinau', ...overrides });

const feedOf = (items: unknown[], nextCursor: string | null = null): MockResponse =>
  apiOk({ items, nextCursor });

/**
 * One page further back the feed holds a3, a Незалежний майстер's Запис booked on a clock with no
 * summer time: 10:00Z is 14:00 in Tbilisi whatever the season, and 03:00 or 02:00 here.
 */
const OLDER = venueRow('a3', {
  venueName: 'Ana Rusu',
  salonId: null,
  masterName: 'Ana Rusu',
  timezone: 'Asia/Tbilisi',
});

const clientFeed = (url: URL): MockResponse =>
  url.searchParams.get('cursor') === 'next-1'
    ? feedOf([OLDER])
    : feedOf([venueRow('a1'), venueRow('a2')], 'next-1');

const clientRoutes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/clients/c1': apiOk(clientProfile('c1', 'Maria Client')),
  [CLIENT_FEED]: clientFeed,
  [DETAILS_A1]: apiOk(details('a1')),
  [DETAILS_A2]: apiOk(details('a2')),
  ...extra,
});

/**
 * The feed's own round trip: its older page is asked for and drawn. A late answer let go before
 * this has been drawn by the time it is. Once per spec — the feed has one older page. Pressed
 * through the page itself, past a confirmation's mask if one is open.
 */
async function olderPage(page: Page): Promise<void> {
  await page.getByTestId('appointments-more').dispatchEvent('click');
  await expect(rows(page)).toHaveCount(3);
}

/** Picks a status in the feed's own filter; it lives in the tab, not in the address. */
async function pickStatus(page: Page, label: string): Promise<void> {
  await page.getByTestId('appointments-filter-status').click();
  await page.getByRole('option', { name: label }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

test.describe('Записи Клієнта', () => {
  test('details answered after another Запис was opened stay out of it', async ({
    page,
    mockBackend,
  }) => {
    const late = holdResponse(apiOk(details('a1', { notes: 'Про Марію' })));
    const next = holdResponse(apiOk(details('a2')));
    await mockBackend(
      ADMIN,
      clientRoutes({ [DETAILS_A1]: late.respond, [DETAILS_A2]: next.respond }),
    );
    await signIn(page, ADMIN, CLIENT_TAB);

    await rows(page).nth(0).click();
    await late.requested;
    await rows(page).nth(1).click();
    await next.requested;

    // The next Запис is still being read when the last one's answer lands.
    await late.release();
    await olderPage(page);

    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-loading')).toBeVisible();

    await next.release();
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText(
      'Elena Client',
    );
    await expect(opened(page).getByTestId('appointment-details-notes')).not.toContainText(
      'Марію',
    );
    await expectOpen(page, 1);
  });

  test('an action answered after another Запис was opened redraws its own row, not the open details', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(ADMIN, clientRoutes({ [STATUS_A1]: lateCancel.respond }));
    await signIn(page, ADMIN, CLIENT_TAB);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;
    // Past the confirmation's mask, as on a Салон's tab.
    await rows(page).nth(1).dispatchEvent('click');
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');
    await expect(opened(page).getByTestId('appointment-actions')).toBeVisible();
  });

  test('a cancellation under a «заброньовано» filter redraws its row and its details, and the row stays', async ({
    page,
    mockBackend,
  }) => {
    const asked: (string | null)[] = [];
    await mockBackend(
      ADMIN,
      clientRoutes({
        [CLIENT_FEED]: (url) => {
          asked.push(url.searchParams.get('status'));
          return feedOf(
            url.searchParams.has('status')
              ? [venueRow('a1'), venueRow('a2')]
              : [venueRow('a1'), venueRow('a2'), venueRow('a3', { status: 'COMPLETED' })],
          );
        },
        [STATUS_A1]: apiOk(details('a1', { status: 'CANCELLED' })),
      }),
    );
    await signIn(page, ADMIN, CLIENT_TAB);
    await expect(rows(page)).toHaveCount(3);
    await pickStatus(page, 'Заброньовано');
    await expect(rows(page)).toHaveCount(2);

    await rows(page).nth(0).click();
    await cancelOpened(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-actions-closed')).toBeVisible();
    // Absorbed, not re-read: under this filter a re-read would drop the row from under its card.
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, 0);
    expect(asked).toEqual([null, 'BOOKED']);
  });

  test('an action answered after the status filter changed leaves the list read since as it was read', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      clientRoutes({
        [CLIENT_FEED]: (url) =>
          url.searchParams.has('cursor')
            ? feedOf([OLDER])
            : feedOf(
                url.searchParams.has('status')
                  ? [venueRow('a1'), venueRow('a2')]
                  : [venueRow('a1'), venueRow('a2'), venueRow('a3', { status: 'COMPLETED' })],
                'next-1',
              ),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, CLIENT_TAB);
    await expect(rows(page)).toHaveCount(3);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;
    // Closed past the confirmation's mask, so the filter can be reached as a pointer reaches it.
    await rows(page).nth(0).dispatchEvent('click');
    await expectOpen(page, null);

    await pickStatus(page, 'Заброньовано');
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, null);

    await lateCancel.release();
    await olderPage(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
    await expectOpen(page, null);
  });

  test('an older page drawn under an open Запис leaves it open, each row on its own clock', async ({
    page,
    mockBackend,
  }) => {
    const cursors: (string | null)[] = [];
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      clientRoutes({
        [CLIENT_FEED]: (url) => {
          cursors.push(url.searchParams.get('cursor'));
          return clientFeed(url);
        },
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, CLIENT_TAB);

    await rows(page).nth(0).click();
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Maria Client');
    await cancelOpened(page);
    await lateCancel.requested;

    await olderPage(page);

    await expectOpen(page, 0);
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Maria Client');
    expect(cursors).toEqual([null, 'next-1']);
    await expect(page.getByTestId('appointments-more')).toHaveCount(0);
    const older = rows(page).nth(2);
    await expect(older.getByTestId('appointment-row-venue')).toHaveText('Ana Rusu');
    await expect(older.getByTestId('appointment-row-timezone')).toHaveText('Asia/Tbilisi');
    await expect(older.getByTestId('appointment-row-when')).toContainText('14:00');

    // The page drawn since is the same list: the action taken before it still lands in both.
    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expectOpen(page, 0);
  });

  test('an action answered after the card moved to another Клієнт and back leaves the list read since as it was read', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      clientRoutes({
        'GET /admin/clients/c2': apiOk(clientProfile('c2', 'Olga Client')),
        'GET /admin/clients/c2/appointments': feedOf([venueRow('a3')]),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, CLIENT_TAB);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    await goBackTo(page, '/clients/c2/appointments');
    await expect(page.getByTestId('card-title')).toHaveText('Olga Client');
    await expect(rows(page)).toHaveCount(1);
    await goBackTo(page, CLIENT_TAB);
    await expect(page.getByTestId('card-title')).toHaveText('Maria Client');
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, null);

    await lateCancel.release();
    await olderPage(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
    await expectOpen(page, null);
  });
});

const PLATFORM_LIST = 'GET /admin/appointments';
const DAY_STATE = 'GET /admin/appointments/day';
const DAY_VIEW = `/appointments?date=${DAY}`;

/** The page polls every two seconds while a gathering reads. */
const FOLLOW = { timeout: 10_000 };

const run = (runId: string, status: string, overrides: Record<string, unknown> = {}) => ({
  runId,
  status,
  startedAt: SEEN,
  finishedAt: status === 'running' ? null : SEEN,
  scannedItems: 1000,
  estimatedItems: 5000,
  errorCode: null,
  ...overrides,
});

/** What a gathering left: the day's Записи as the table was read by `runId`. */
const gathered = (runId: string, items: unknown[]) => ({
  runId,
  date: DAY,
  builtAt: SEEN,
  timeZone: 'Europe/Chisinau',
  scannedItems: 5000,
  items,
});

const dayState = (state: { run: unknown; result: unknown }): MockResponse => apiOk(state);

/** A gathering still reading, the day's previous list on screen beneath it. */
const reading = (polled: number) =>
  dayState({
    run: run('run-2', 'running', { scannedItems: polled * 100 }),
    result: gathered('run-1', [venueRow('a1'), venueRow('a2')]),
  });

/** That gathering done with a new list, and another already reading again over it. */
const REGATHERED = dayState({
  run: run('run-3', 'running'),
  result: gathered('run-2', [venueRow('a1'), venueRow('a2'), venueRow('a3')]),
});

/**
 * What every view of the page loads besides its list: the pickers' own lists, left empty — these
 * specs open their views by address.
 */
const platformRoutes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons': apiOk({ builtAt: SEEN, items: [] }),
  'GET /admin/masters': apiOk({ builtAt: SEEN, items: [] }),
  'GET /admin/clients': apiOk({ builtAt: SEEN, items: [] }),
  'GET /admin/salons/s1/masters': apiOk({ items: [rosterMaster] }),
  [DETAILS_A1]: apiOk(details('a1')),
  [DETAILS_A2]: apiOk(details('a2')),
  ...extra,
});

/** Waits for two more polls of the day to reach the backend — the page's own round trip. */
async function morePolls(polls: () => number): Promise<void> {
  const seen = polls();
  await expect.poll(polls, FOLLOW).toBeGreaterThanOrEqual(seen + 2);
}

test.describe('Записи платформи за день', () => {
  test('a Запис open while the day is gathered again stays open, and so does what an action changed in it', async ({
    page,
    mockBackend,
  }) => {
    let polls = 0;
    await mockBackend(
      ADMIN,
      platformRoutes({
        [DAY_STATE]: () => reading(++polls),
        [STATUS_A1]: apiOk(details('a1', { status: 'CANCELLED' })),
      }),
    );
    await signIn(page, ADMIN, `${DAY_VIEW}&status=BOOKED`);
    await expect(rows(page)).toHaveCount(2);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');

    // Every poll answers with the same previous list: it is not a new one.
    await morePolls(() => polls);

    await expectOpen(page, 0);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-actions-closed')).toBeVisible();
  });

  test('a failed gathering leaves the previous list on screen, and the Запис open in it', async ({
    page,
    mockBackend,
  }) => {
    let failed = false;
    await mockBackend(
      ADMIN,
      platformRoutes({
        [DAY_STATE]: () =>
          failed
            ? dayState({
                run: run('run-2', 'failed', { errorCode: 'TIMED_OUT' }),
                result: gathered('run-1', [venueRow('a1'), venueRow('a2')]),
              })
            : reading(1),
      }),
    );
    await signIn(page, ADMIN, DAY_VIEW);

    await rows(page).nth(1).click();
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    failed = true;

    await expect(page.getByTestId('appointments-day-failed')).toContainText('не встигло', FOLLOW);
    await expect(page.getByTestId('appointments-day-progress')).toHaveCount(0);
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');
  });

  test('a new list gathered under an open Запис closes it, and its late details stay out', async ({
    page,
    mockBackend,
  }) => {
    const lateDetails = holdResponse(apiOk(details('a1')));
    let replaced = false;
    let polls = 0;
    await mockBackend(
      ADMIN,
      platformRoutes({
        [DAY_STATE]: () => {
          polls += 1;
          return replaced ? REGATHERED : reading(polls);
        },
        [DETAILS_A1]: lateDetails.respond,
      }),
    );
    await signIn(page, ADMIN, DAY_VIEW);

    await rows(page).nth(0).click();
    await lateDetails.requested;
    await expect(opened(page).getByTestId('appointment-details-loading')).toBeVisible();

    replaced = true;
    await expect(rows(page)).toHaveCount(3, FOLLOW);
    await expectOpen(page, null);

    await lateDetails.release();
    await morePolls(() => polls);

    await expectOpen(page, null);
  });

  test('an action answered after a new list was gathered leaves that list as it was read', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    let replaced = false;
    let polls = 0;
    await mockBackend(
      ADMIN,
      platformRoutes({
        [DAY_STATE]: () => {
          polls += 1;
          return replaced ? REGATHERED : reading(polls);
        },
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, DAY_VIEW);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    replaced = true;
    await expect(rows(page)).toHaveCount(3, FOLLOW);
    await expectOpen(page, null);

    await lateCancel.release();
    await morePolls(() => polls);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
    await expectOpen(page, null);
  });

  test('an action answered after the status filter changed leaves the list drawn since as it was drawn', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      platformRoutes({
        [DAY_STATE]: dayState({
          run: run('run-1', 'succeeded'),
          result: gathered('run-1', [venueRow('a1'), venueRow('a2', { status: 'COMPLETED' })]),
        }),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, DAY_VIEW);
    await expect(rows(page)).toHaveCount(2);

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    // The same gathered day, cut by status in the browser: a list of its own.
    await goBackTo(page, `${DAY_VIEW}&status=BOOKED`);
    await expect(rows(page)).toHaveCount(1);
    await expectOpen(page, null);

    await lateCancel.release();
    // A round trip of the list's own: the Запис is opened again and read afresh.
    await rows(page).nth(0).click();
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
  });
});

test.describe('Записи платформи для одного Салону, Майстра чи Клієнта', () => {
  test('a cancellation under a «заброньовано» filter redraws its row and its details, and the row stays', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      platformRoutes({
        [PLATFORM_LIST]: (url) => {
          asked.push(url.searchParams);
          return apiOk({ items: [venueRow('a1'), venueRow('a2')] });
        },
        [STATUS_A1]: apiOk(details('a1', { status: 'CANCELLED' })),
      }),
    );
    await signIn(page, ADMIN, '/appointments?salonId=s1&status=BOOKED');

    await rows(page).nth(0).click();
    await cancelOpened(page);

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Скасовано');
    await expect(opened(page).getByTestId('appointment-actions-closed')).toBeVisible();
    // Absorbed, not re-read: under this filter a re-read would drop the row from under its card.
    await expect(rows(page)).toHaveCount(2);
    await expectOpen(page, 0);
    expect(asked.map((params) => [params.get('salonId'), params.get('status')])).toEqual([
      ['s1', 'BOOKED'],
    ]);
  });

  test('an action answered after another Запис was opened redraws its own row, not the open details', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      platformRoutes({
        [PLATFORM_LIST]: apiOk({ items: [venueRow('a1'), venueRow('a2')] }),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, '/appointments?salonId=s1');

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;
    // Past the confirmation's mask, as on a Салон's tab.
    await rows(page).nth(1).dispatchEvent('click');
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await lateCancel.release();

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expectOpen(page, 1);
    await expect(opened(page).getByTestId('appointment-details-status')).toHaveText('Заброньовано');
    await expect(opened(page).getByTestId('appointment-actions')).toBeVisible();
  });

  test('an action answered after the list was narrowed to someone else leaves the list read since as it was read', async ({
    page,
    mockBackend,
  }) => {
    const lateCancel = holdResponse(apiOk(details('a1', { status: 'CANCELLED' })));
    await mockBackend(
      ADMIN,
      platformRoutes({
        [PLATFORM_LIST]: (url) =>
          apiOk({
            items: url.searchParams.has('clientId')
              ? [venueRow('a1'), venueRow('a2'), venueRow('a3')]
              : [venueRow('a1'), venueRow('a2')],
          }),
        [STATUS_A1]: lateCancel.respond,
      }),
    );
    await signIn(page, ADMIN, '/appointments?salonId=s1');
    await expect(page).toHaveURL(/from=/);
    const window = new URL(page.url()).searchParams;

    await rows(page).nth(0).click();
    await cancelOpened(page);
    await lateCancel.requested;

    await goBackTo(
      page,
      `/appointments?clientId=client-a1&from=${window.get('from')}&to=${window.get('to')}`,
    );
    await expect(rows(page)).toHaveCount(3);
    await expectOpen(page, null);

    await lateCancel.release();
    // A round trip of the list's own: another Запис is opened and read.
    await rows(page).nth(1).click();
    await expect(opened(page).getByTestId('appointment-details-client')).toHaveText('Elena Client');

    await expect(rows(page).nth(0).getByTestId('appointment-row-status')).toHaveText(
      'Заброньовано',
    );
  });
});
