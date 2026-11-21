import { apiError, apiOk, holdResponse, type MockResponse } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * «Активність» of a card: the «Журнал активності» feed of the profile it is open on, its filter
 * fixed — a Салон's Місце, a Майстер's own actions (and a Незалежний майстер's Місце), a Клієнт's
 * actions — with a way on to the screen under the same filter, to narrow it further.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const ACTIVITY = 'GET /admin/activity';

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  owner: { ownerId: 'owner-1', name: 'Ana Rusu', email: 'ana@beautylab.md' },
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

const entry = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'act-1',
  createdAt: '2026-09-21T10:00:00.000Z',
  stage: 'dev',
  service: 'client-api',
  route: 'PATCH /client/appointments/{appointmentId}/cancel',
  pathParams: { appointmentId: 'appt-1' },
  actor: { id: 'c1', role: 'client', name: 'Maria Rusu' },
  claimedActorId: null,
  salonId: null,
  masterId: null,
  place: null,
  outcome: 'ok',
  status: 200,
  error: null,
  durationMs: 87,
  requestBody: null,
  requestBodyTruncated: false,
  requestId: 'req-1',
  traceId: null,
  sentryEventId: null,
  ...overrides,
});

const pageOf = (items: unknown[], nextCursor: string | null = null): MockResponse =>
  apiOk({ items, nextCursor });

/** The questions the log was asked, as plain objects, in order. */
const asked = (seen: URLSearchParams[]) => seen.map((params) => Object.fromEntries(params));

const CARDS = [
  { name: 'Салон', path: '/salons/s1' },
  { name: 'Незалежний майстер', path: '/independent-masters/m1' },
  { name: 'Майстер салону', path: '/salons/s1/masters/m1' },
  { name: 'Клієнт', path: '/clients/c1' },
];

test.describe('«Активність» on a card', () => {
  for (const card of CARDS) {
    test(`is a tab of the card of a ${card.name}`, async ({ page, mockBackend }) => {
      await mockBackend(ADMIN, {
        'GET /admin/me': ME,
        'GET /admin/salons/s1': apiOk(salon()),
        'GET /admin/masters/m1': apiOk(master()),
        'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
        'GET /admin/clients/c1': apiOk(client()),
        [ACTIVITY]: pageOf([entry()]),
      });
      await signIn(page, ADMIN, `${card.path}/profile`);

      const tab = page.getByTestId('card-tab').filter({ hasText: 'Активність' });
      await expect(tab).toHaveAttribute('href', `${card.path}/activity`);
      await tab.click();

      await expect(page).toHaveURL(new RegExp(`${card.path}/activity$`));
      await expect(page.getByTestId('activity-row')).toHaveCount(1);
    });
  }

  test('a Салон shows its Місце, opens it in the «Журнал активності», and leads on to its Власник across his Мережа', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([
          entry({
            salonId: 's1',
            place: { type: 'salon', id: 's1', name: 'Beauty Lab' },
          }),
          entry({
            activityId: 'act-2',
            service: 'salon-api',
            route: 'POST /salon/appointments',
            pathParams: {},
            actor: { id: 'owner-1', role: 'salon', name: 'Ana Rusu' },
            salonId: 's1',
            place: { type: 'salon', id: 's1', name: 'Beauty Lab' },
            outcome: 'rejected',
            status: 409,
            error: { code: 'SLOT_UNAVAILABLE', message: 'Slot is taken' },
            requestId: 'req-2',
          }),
        ]);
      },
    });

    await signIn(page, ADMIN, '/salons/s1/activity');

    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(2);
    // The Місце, read whole: no period.
    expect(asked(seen)).toEqual([{ placeId: 's1' }]);
    await expect(page.getByTestId('activity-tab-kept')).toBeVisible();
    // A Салон has one feed: nothing to switch between.
    await expect(page.getByTestId('activity-tab-subject')).toHaveCount(0);

    // Worded and linked as the screen words them.
    await expect(rows.nth(1).getByTestId('activity-actor-link')).toHaveText('Ana Rusu');
    await expect(rows.nth(1).getByTestId('activity-actor')).toContainText('Власник салону');
    await expect(rows.nth(1).getByTestId('activity-action')).toHaveText('Створення Запису Салоном');
    await expect(rows.nth(1).getByTestId('activity-outcome')).toContainText('SLOT_UNAVAILABLE');
    await rows.nth(1).click();
    await expect(
      page.getByTestId('activity-details').getByTestId('activity-request-id'),
    ).toHaveText('req-2');

    const owner = page.getByTestId('activity-tab-owner');
    await expect(owner).toHaveText('Активність Власника');
    await expect(owner).toHaveAttribute('href', '/activity-log?account=owner-1');

    const open = page.getByTestId('activity-tab-open-log');
    await expect(open).toHaveText('Відкрити в Журналі активності');
    await expect(open).toHaveAttribute('href', '/activity-log?place=s1');

    await open.click();

    await expect(page).toHaveURL(/\/activity-log\?place=s1$/);
    await expect(page.getByTestId('section-title')).toHaveText('Журнал активності');
    await expect(page.getByTestId('activity-filter-place')).toHaveValue('s1');
    await expect(page.getByTestId('activity-period-kept')).toBeVisible();
    await expect.poll(() => asked(seen).at(-1)).toEqual({ placeId: 's1' });

    await page.goBack();
    await expect(page).toHaveURL(/\/salons\/s1\/activity$/);
    await page.getByTestId('activity-tab-owner').click();

    // The Власник as the one who acted, wherever in his Мережа.
    await expect(page).toHaveURL(/\/activity-log\?account=owner-1$/);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('owner-1');
    await expect.poll(() => asked(seen).at(-1)).toEqual({ actorId: 'owner-1' });
  });

  test('a Салон whose Власник admin-api does not name offers no «Активність Власника»', async ({
    page,
    mockBackend,
  }) => {
    const { owner: _owner, ...unnamed } = salon();
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(unnamed),
      [ACTIVITY]: pageOf([entry()]),
    });

    await signIn(page, ADMIN, '/salons/s1/activity');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-tab-open-log')).toHaveAttribute(
      'href',
      '/activity-log?place=s1',
    );
    await expect(page.getByTestId('activity-tab-owner')).toHaveCount(0);
  });

  test('a Незалежний майстер shows his own actions, and all that happened in his Місце on demand', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': apiOk(master()),
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return url.searchParams.has('placeId')
          ? pageOf([
              entry({
                activityId: 'act-place-1',
                place: { type: 'master', id: 'm1', name: 'Ion Popa' },
              }),
              entry({
                activityId: 'act-place-2',
                place: { type: 'master', id: 'm1', name: 'Ion Popa' },
              }),
            ])
          : pageOf([
              entry({
                actor: { id: 'm1', role: 'master', name: 'Ion Popa' },
                service: 'master-api',
                route: 'PUT /master/hours',
                pathParams: {},
              }),
            ]);
      },
    });

    await signIn(page, ADMIN, '/independent-masters/m1/activity');

    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(1);
    expect(asked(seen)).toEqual([{ actorId: 'm1' }]);
    await expect(page.getByTestId('activity-tab-open-log')).toHaveAttribute(
      'href',
      '/activity-log?account=m1',
    );
    // Only a Салон has a Власник.
    await expect(page.getByTestId('activity-tab-owner')).toHaveCount(0);

    const subjects = page.getByTestId('activity-tab-subject');
    await expect(subjects).toContainText('Власні дії');
    await subjects.getByText('Усе в його Місці').click();

    await expect(rows).toHaveCount(2);
    expect(asked(seen).at(-1)).toEqual({ placeId: 'm1' });
    await expect(page.getByTestId('activity-tab-open-log')).toHaveAttribute(
      'href',
      '/activity-log?place=m1',
    );

    await subjects.getByText('Власні дії').click();

    await expect(rows).toHaveCount(1);
    expect(asked(seen).at(-1)).toEqual({ actorId: 'm1' });
  });

  test('a Майстер салону shows his own actions, wherever he acted', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry({ actor: { id: 'm1', role: 'master', name: 'Ion Popa' } })]);
      },
    });

    await signIn(page, ADMIN, '/salons/s1/masters/m1/activity');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    expect(asked(seen)).toEqual([{ actorId: 'm1' }]);
    await expect(page.getByTestId('activity-tab-subject')).toHaveCount(0);
    // His Салон's Власник is the Салон card's to show.
    await expect(page.getByTestId('activity-tab-owner')).toHaveCount(0);
    await expect(page.getByTestId('activity-tab-open-log')).toHaveAttribute(
      'href',
      '/activity-log?account=m1',
    );
  });

  test('a Клієнт shows all he did, and opens it in the «Журнал активності»', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry()]);
      },
    });

    await signIn(page, ADMIN, '/clients/c1/activity');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    expect(asked(seen)).toEqual([{ actorId: 'c1' }]);
    await expect(page.getByTestId('activity-tab-subject')).toHaveCount(0);
    await expect(page.getByTestId('activity-tab-owner')).toHaveCount(0);

    await page.getByTestId('activity-tab-open-log').click();

    await expect(page).toHaveURL(/\/activity-log\?account=c1$/);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('c1');
    await expect.poll(() => asked(seen).at(-1)).toEqual({ actorId: 'c1' });
  });

  test('loads older entries on demand, and «Оновити» starts over', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return url.searchParams.get('cursor') === 'next-1'
          ? pageOf([entry({ activityId: 'act-2', requestId: 'req-2' })])
          : pageOf([entry()], 'next-1');
      },
    });
    await signIn(page, ADMIN, '/clients/c1/activity');
    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('activity-more').click();

    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('activity-more')).toHaveCount(0);
    expect(asked(seen).at(-1)).toEqual({ actorId: 'c1', cursor: 'next-1' });

    await page.getByTestId('activity-refresh').click();

    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('activity-more')).toBeVisible();
    expect(asked(seen).at(-1)).toEqual({ actorId: 'c1' });
  });

  test('says when it is loading, when it could not load, and when there is nothing', async ({
    page,
    mockBackend,
  }) => {
    let refuse = true;
    const first = holdResponse(apiError(500, 'INTERNAL_SERVER_ERROR'));
    let calls = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      [ACTIVITY]: () => {
        calls += 1;
        if (calls === 1) {
          return first.respond();
        }
        return refuse ? apiError(500, 'INTERNAL_SERVER_ERROR') : pageOf([]);
      },
    });
    await signIn(page, ADMIN, '/clients/c1/activity');

    await first.requested;
    await expect(page.getByTestId('activity-loading')).toBeVisible();
    await first.release();

    await expect(page.getByTestId('activity-failed')).toBeVisible();
    await expect(page.getByTestId('activity-loading')).toHaveCount(0);

    refuse = false;
    await page.getByTestId('activity-refresh').click();

    await expect(page.getByTestId('activity-empty')).toBeVisible();
    await expect(page.getByTestId('activity-failed')).toHaveCount(0);
  });
});
