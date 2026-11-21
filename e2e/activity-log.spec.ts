import { apiError, apiOk, holdResponse, type MockResponse } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const ACTIVITY = 'GET /admin/activity';

const entry = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'act-1',
  createdAt: '2026-09-21T10:00:00.000Z',
  stage: 'dev',
  service: 'client-api',
  route: 'PATCH /client/appointments/{appointmentId}/cancel',
  pathParams: { appointmentId: 'appt-1' },
  actor: { id: 'client-sub-1', role: 'client', name: null },
  claimedActorId: null,
  salonId: null,
  masterId: null,
  place: null,
  outcome: 'ok',
  status: 200,
  error: null,
  durationMs: 87,
  requestId: 'req-1',
  traceId: null,
  sentryEventId: null,
  ...overrides,
});

const pageOf = (items: unknown[], nextCursor: string | null = null): MockResponse =>
  apiOk({ items, nextCursor });

test.describe('activity log screen', () => {
  // The log runs on the platform's clock, wherever the browser is.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('opens on today’s entries, newest first as served, every column on the platform’s clock', async ({
    page,
    mockBackend,
  }) => {
    const seen: string[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.search);
        return pageOf([
          entry(),
          entry({
            activityId: 'act-2',
            createdAt: '2026-09-21T09:15:00.000Z',
            service: 'salon-api',
            route: 'POST /salon/appointments',
            pathParams: {},
            actor: { id: 'owner-sub-1', role: 'salon', name: null },
            outcome: 'rejected',
            status: 409,
            error: { code: 'SLOT_UNAVAILABLE', message: 'Slot is taken' },
            durationMs: 1240,
          }),
          entry({
            activityId: 'act-3',
            createdAt: '2026-09-21T08:30:00.000Z',
            service: 'master-api',
            route: 'POST /master/brand-new-thing',
            pathParams: {},
            actor: null,
            outcome: 'failed',
            status: 500,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
            durationMs: 3012,
          }),
        ]);
      },
    });

    await signIn(page, ADMIN, '/activity-log');

    await expect(page.getByTestId('section-title')).toHaveText('Журнал активності');
    // Nothing asked: the backend serves today on the platform's clock.
    await expect(page.getByTestId('activity-period-today')).toBeVisible();
    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(3);
    expect(seen).toEqual(['']);

    const first = rows.nth(0);
    // 10:00Z is 13:00 in Chișinău in September.
    await expect(first.getByTestId('activity-time')).toContainText('13:00');
    await expect(first.getByTestId('activity-actor')).toContainText('client-sub-1');
    await expect(first.getByTestId('activity-actor')).toContainText('Клієнт');
    await expect(first.getByTestId('activity-action')).toHaveText('Скасування Запису Клієнтом');
    await expect(first.getByTestId('activity-outcome')).toContainText('Успіх');
    await expect(first.getByTestId('activity-outcome')).toContainText('200');
    await expect(first.getByTestId('activity-outcome')).toHaveClass(/p-tag-success/);
    await expect(first.getByTestId('activity-duration')).toHaveText('87 мс');

    const second = rows.nth(1);
    await expect(second.getByTestId('activity-time')).toContainText('12:15');
    await expect(second.getByTestId('activity-actor')).toContainText('owner-sub-1');
    await expect(second.getByTestId('activity-actor')).toContainText('Власник');
    await expect(second.getByTestId('activity-action')).toHaveText('Створення Запису Салоном');
    await expect(second.getByTestId('activity-outcome')).toContainText('Відмова');
    await expect(second.getByTestId('activity-outcome')).toContainText('409');
    await expect(second.getByTestId('activity-outcome')).toContainText('SLOT_UNAVAILABLE');
    await expect(second.getByTestId('activity-outcome')).toHaveClass(/p-tag-warn/);
    await expect(second.getByTestId('activity-duration')).toHaveText('1240 мс');

    const third = rows.nth(2);
    await expect(third.getByTestId('activity-actor')).toHaveText('Без входу');
    // A route the dictionaries do not word yet is shown as it is.
    await expect(third.getByTestId('activity-action')).toHaveText('POST /master/brand-new-thing');
    await expect(third.getByTestId('activity-outcome')).toContainText('Збій');
    await expect(third.getByTestId('activity-outcome')).toContainText('500');
    await expect(third.getByTestId('activity-outcome')).toContainText('INTERNAL_SERVER_ERROR');
    await expect(third.getByTestId('activity-outcome')).toHaveClass(/p-tag-danger/);

    await expect(page.getByTestId('activity-more')).toHaveCount(0);
  });

  test('names who acted and where, each linked to its card where it has one, and a claimed actor as unverified', async ({
    page,
    mockBackend,
  }) => {
    const studio = { type: 'salon', id: 'salon-2', name: 'Studio Botanica' };
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: pageOf([
        entry({
          actor: { id: 'client-sub-1', role: 'client', name: 'Ana Rusu' },
          salonId: 'salon-2',
          masterId: 'iryna',
          place: studio,
        }),
        entry({
          activityId: 'act-2',
          actor: { id: 'owner-1', role: 'salon', name: 'Ion Popa' },
          salonId: 'salon-2',
          place: studio,
        }),
        entry({
          activityId: 'act-3',
          actor: { id: 'olena', role: 'salon_admin', name: 'Olena Rotaru' },
          salonId: 'salon-2',
          place: studio,
        }),
        entry({
          activityId: 'act-4',
          actor: { id: 'nina', role: 'master', name: 'Nina Lupu' },
          masterId: 'nina',
          place: { type: 'master', id: 'nina', name: 'Nina Lupu' },
        }),
        entry({
          activityId: 'act-5',
          actor: { id: 'admin-sub', role: 'admin', name: null },
          salonId: 'salon-404',
          place: { type: 'salon', id: 'salon-404', name: null },
        }),
        entry({
          activityId: 'act-6',
          actor: null,
          claimedActorId: 'client-sub-9',
          outcome: 'rejected',
          status: 401,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        }),
      ]),
    });

    await signIn(page, ADMIN, '/activity-log');

    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(6);
    const actorLink = (row: number) => rows.nth(row).getByTestId('activity-actor-link');
    const place = (row: number) => rows.nth(row).getByTestId('activity-place');
    const placeLink = (row: number) => place(row).getByRole('link');

    // A Клієнт, by name, to his card; the Салон he booked into, to its card.
    await expect(actorLink(0)).toHaveText('Ana Rusu');
    await expect(actorLink(0)).toHaveAttribute('href', '/clients/client-sub-1');
    await expect(rows.nth(0).getByTestId('activity-actor')).toContainText('Клієнт');
    await expect(placeLink(0)).toHaveText('Studio Botanica');
    await expect(placeLink(0)).toHaveAttribute('href', '/salons/salon-2');
    await expect(place(0)).toContainText('Салон');

    // A Власник, to the card of his Основний салон — its id is his.
    await expect(actorLink(1)).toHaveText('Ion Popa');
    await expect(actorLink(1)).toHaveAttribute('href', '/salons/owner-1');

    // An Адміністратор has no card of his own: his name, not a link.
    await expect(rows.nth(2).getByTestId('activity-actor')).toContainText('Olena Rotaru');
    await expect(actorLink(2)).toHaveCount(0);

    // A Незалежний майстер is his own Місце; his card opens either way.
    await expect(actorLink(3)).toHaveAttribute('href', '/independent-masters/nina');
    await expect(placeLink(3)).toHaveText('Nina Lupu');
    await expect(placeLink(3)).toHaveAttribute('href', '/independent-masters/nina');
    await expect(place(3)).toContainText('Майстер');

    // Nobody named: the id stands in, and a Місце whose profile is gone still leads to its card.
    await expect(rows.nth(4).getByTestId('activity-actor')).toContainText('admin-sub');
    await expect(rows.nth(4).getByTestId('activity-actor')).toContainText('Адміністратор платформи');
    await expect(actorLink(4)).toHaveCount(0);
    await expect(placeLink(4)).toHaveText('salon-404');
    await expect(placeLink(4)).toHaveAttribute('href', '/salons/salon-404');

    // A refused token: nobody signed in, and whom it claimed, unverified.
    const claimed = rows.nth(5).getByTestId('activity-actor');
    await expect(claimed).toContainText('Без входу');
    await expect(claimed.getByTestId('activity-claimed-actor')).toContainText('client-sub-9');
    await expect(claimed.getByTestId('activity-claimed-actor')).toContainText('неперевірено');
    await expect(place(5)).toHaveText('—');
  });

  test('words the action in the language of the interface', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: pageOf([entry()]),
    });
    await signIn(page, ADMIN, '/activity-log');
    const action = page.getByTestId('activity-action');
    await expect(action).toHaveText('Скасування Запису Клієнтом');

    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();

    await expect(action).toHaveText('Anularea Programării de către Client');
    await expect(page.getByTestId('activity-actor')).toContainText('Client');
    await expect(page.getByTestId('activity-outcome')).toContainText('Succes');
  });

  test('keeps the period in the address and sends it as whole days on the platform’s clock', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf(url.searchParams.has('from') ? [entry()] : []);
      },
    });
    await signIn(page, ADMIN, '/activity-log');
    await expect(page.getByTestId('activity-empty')).toBeVisible();

    await page.getByTestId('activity-filter-from').fill('2026-09-01');
    await page.getByTestId('activity-filter-to').fill('2026-09-21');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page).toHaveURL(/from=2026-09-01/);
    await expect(page).toHaveURL(/to=2026-09-21/);
    await expect(page.getByTestId('activity-period-today')).toHaveCount(0);
    // Whole days on Chișinău's clock, the last one included — not on the browser's.
    await expect.poll(() => Object.fromEntries(seen.at(-1)!)).toEqual({
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
    });

    // An end typed before the start wins; the address never holds a period that reads as none.
    await page.getByTestId('activity-filter-to').fill('2026-08-15');

    await expect(page).toHaveURL(/\/activity-log\?to=2026-08-15$/);
    await expect(page.getByTestId('activity-filter-from')).toHaveValue('');
    await expect(page.getByTestId('activity-filter-to')).toHaveValue('2026-08-15');
    await expect(page.getByTestId('activity-empty')).toBeVisible();
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ to: '2026-08-15T21:00:00.000Z' });

    await page.getByTestId('activity-filter-reset').click();

    await expect(page).toHaveURL(/\/activity-log$/);
    // The list was empty before the reset too: wait for the question rather than for the screen.
    await expect.poll(() => [...seen.at(-1)!.keys()]).toEqual([]);
    await expect(page.getByTestId('activity-empty')).toBeVisible();
  });

  test('reopens a copied link with the same period', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry()]);
      },
    });

    await signIn(page, ADMIN, '/activity-log?from=2026-09-21&to=2026-09-21');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-filter-from')).toHaveValue('2026-09-21');
    await expect(page.getByTestId('activity-filter-to')).toHaveValue('2026-09-21');
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({
      from: '2026-09-20T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
    });
  });

  test('reads a period the address got wrong as no period', async ({ page, mockBackend }) => {
    const seen: string[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.search);
        return pageOf([entry()]);
      },
    });

    await signIn(page, ADMIN, '/activity-log?from=2026-09-21&to=2026-09-01');

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-filter-from')).toHaveValue('');
    await expect(page.getByTestId('activity-filter-to')).toHaveValue('');
    await expect(page.getByTestId('activity-period-today')).toBeVisible();
    expect(seen).toEqual(['']);
  });

  test('narrows by account, Місце, role, outcome, service and action, each kept in the address and sent as the backend names it', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry()]);
      },
    });
    await signIn(page, ADMIN, '/activity-log');
    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-filter-reset')).toHaveCount(0);
    const asked = () => Object.fromEntries(seen.at(-1)!);

    // An email is looked up by the backend; the address keeps what was typed, trimmed.
    await page.getByTestId('activity-filter-account').fill('  ana@example.com ');
    await page.getByTestId('activity-filter-account').press('Enter');

    await expect(page).toHaveURL(/account=ana@example\.com/);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('ana@example.com');
    await expect.poll(asked).toEqual({ account: 'ana@example.com' });
    // An account's log is read whole, not today's.
    await expect(page.getByTestId('activity-period-kept')).toBeVisible();
    await expect(page.getByTestId('activity-period-today')).toHaveCount(0);
    await expect(page.getByTestId('activity-filter-reset')).toBeVisible();

    // Anything else is the account's id.
    await page.getByTestId('activity-filter-account').fill('client-sub-1');
    await page.getByTestId('activity-filter-account').press('Enter');
    await expect.poll(asked).toEqual({ actorId: 'client-sub-1' });

    await page.getByTestId('activity-filter-place').fill('salon-2');
    await page.getByTestId('activity-filter-place').press('Enter');
    await expect.poll(asked).toEqual({ actorId: 'client-sub-1', placeId: 'salon-2' });

    await page.getByTestId('activity-filter-role').click();
    await page.getByRole('option', { name: 'Без входу' }).click();
    await page.getByTestId('activity-filter-outcome').click();
    await page.getByRole('option', { name: 'Збій' }).click();
    await page.getByTestId('activity-filter-service').click();
    await page.getByRole('option', { name: 'Адмінка' }).click();
    await page.getByTestId('activity-filter-route').click();
    await page.getByRole('option', { name: 'Скасування Запису Клієнтом' }).click();

    await expect.poll(asked).toEqual({
      actorId: 'client-sub-1',
      placeId: 'salon-2',
      role: 'anonymous',
      outcome: 'failed',
      service: 'admin-api',
      route: 'PATCH /client/appointments/{appointmentId}/cancel',
    });
    await expect(page).toHaveURL(/account=client-sub-1/);
    await expect(page).toHaveURL(/place=salon-2/);
    await expect(page).toHaveURL(/role=anonymous/);
    await expect(page).toHaveURL(/outcome=failed/);
    await expect(page).toHaveURL(/service=admin-api/);
    await expect(page).toHaveURL(/route=PATCH/);

    // A select cleared on its own leaves the address; the rest stay.
    await page.getByTestId('activity-filter-outcome').locator('.p-select-clear-icon').click();
    await expect.poll(asked).toEqual({
      actorId: 'client-sub-1',
      placeId: 'salon-2',
      role: 'anonymous',
      service: 'admin-api',
      route: 'PATCH /client/appointments/{appointmentId}/cancel',
    });
    await expect(page).not.toHaveURL(/outcome=/);

    await page.getByTestId('activity-filter-reset').click();

    await expect(page).toHaveURL(/\/activity-log$/);
    await expect.poll(() => [...seen.at(-1)!.keys()]).toEqual([]);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('');
    await expect(page.getByTestId('activity-filter-place')).toHaveValue('');
    await expect(page.getByTestId('activity-period-today')).toBeVisible();
    await expect(page.getByTestId('activity-filter-reset')).toHaveCount(0);
  });

  test('reopens a copied link with every filter, an action the dictionaries do not word included', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry()]);
      },
    });

    await signIn(
      page,
      ADMIN,
      '/activity-log?from=2026-09-21&to=2026-09-21&account=ana%40example.com&place=nina&role=master&outcome=rejected&service=master-api&route=POST%20%2Fmaster%2Fbrand-new-thing',
    );

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('ana@example.com');
    await expect(page.getByTestId('activity-filter-place')).toHaveValue('nina');
    await expect(page.getByTestId('activity-filter-role')).toContainText('Майстер');
    await expect(page.getByTestId('activity-filter-outcome')).toContainText('Відмова');
    await expect(page.getByTestId('activity-filter-service')).toContainText('Бізнес-застосунок: Майстер');
    await expect(page.getByTestId('activity-filter-route')).toContainText('POST /master/brand-new-thing');
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({
      from: '2026-09-20T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
      account: 'ana@example.com',
      placeId: 'nina',
      role: 'master',
      outcome: 'rejected',
      service: 'master-api',
      route: 'POST /master/brand-new-thing',
    });
  });

  test('offers an action the dictionaries do not word yet once a row shows it', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return pageOf([entry({ route: 'POST /master/brand-new-thing', pathParams: {} })]);
      },
    });
    await signIn(page, ADMIN, '/activity-log');
    await expect(page.getByTestId('activity-action')).toHaveText('POST /master/brand-new-thing');

    await page.getByTestId('activity-filter-route').click();
    await page.getByRole('option', { name: 'POST /master/brand-new-thing' }).click();

    await expect(page).toHaveURL(/route=POST/);
    await expect.poll(() => Object.fromEntries(seen.at(-1)!)).toEqual({ route: 'POST /master/brand-new-thing' });
  });

  test('reads filter values the address got wrong as not set', async ({ page, mockBackend }) => {
    const seen: string[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.search);
        return pageOf([entry()]);
      },
    });

    await signIn(
      page,
      ADMIN,
      '/activity-log?account=two%20words&place=&role=owner&outcome=denied&service=search-api&route=cancel%20everything',
    );

    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    expect(seen).toEqual(['']);
    await expect(page.getByTestId('activity-filter-account')).toHaveValue('');
    await expect(page.getByTestId('activity-filter-reset')).toHaveCount(0);
    await expect(page.getByTestId('activity-period-today')).toBeVisible();
  });

  test('words the refusal of a period too long for the whole platform', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) =>
        url.searchParams.has('from') ? apiError(400, 'ACTIVITY_PERIOD_TOO_LONG') : pageOf([entry()]),
    });
    await signIn(page, ADMIN, '/activity-log');
    await expect(page.getByTestId('activity-row')).toHaveCount(1);

    await page.getByTestId('activity-filter-from').fill('2026-08-01');

    await expect(page.getByTestId('toast')).toContainText(
      'Без акаунта чи Місця журнал показує щонайбільше 31 день. Звузьте період або задайте акаунт чи Місце.',
    );
    await expect(page.getByTestId('activity-failed')).toBeVisible();
  });

  test('loads older entries on demand under the same period, and «Оновити» starts over', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        seen.push(url.searchParams);
        return url.searchParams.get('cursor') === 'next-1'
          ? pageOf([entry({ activityId: 'act-2', requestId: 'req-2' })])
          : pageOf([entry()], 'next-1');
      },
    });
    await signIn(page, ADMIN, '/activity-log?from=2026-09-20');
    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('activity-more').click();

    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('activity-more')).toHaveCount(0);
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ from: '2026-09-19T21:00:00.000Z', cursor: 'next-1' });

    await page.getByTestId('activity-refresh').click();

    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('activity-more')).toBeVisible();
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ from: '2026-09-19T21:00:00.000Z' });
  });

  test('a page asked under the old period never lands under the new one', async ({ page, mockBackend }) => {
    const late = holdResponse(pageOf([entry({ activityId: 'late', route: 'POST /client/late-route' })]));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: (url) => {
        const filtered = url.searchParams.has('from');
        const cursor = url.searchParams.get('cursor');
        if (!filtered) {
          return cursor === null ? pageOf([entry()], 'next-1') : late.respond();
        }
        return cursor === null
          ? pageOf([entry({ activityId: 'f1', route: 'POST /client/first-route' })], 'next-f')
          : pageOf([entry({ activityId: 'f2', route: 'POST /client/second-route' })]);
      },
    });
    await signIn(page, ADMIN, '/activity-log');
    const rows = page.getByTestId('activity-row');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('activity-more').click();
    await late.requested;
    await page.getByTestId('activity-filter-from').fill('2026-09-01');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('POST /client/first-route');

    await late.release();
    // The new list read further: by the time its page is drawn, the late one has had its chance.
    await page.getByTestId('activity-more').click();

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText('POST /client/second-route');
    await expect(page.getByTestId('activity-table')).not.toContainText('POST /client/late-route');
  });

  test('expands a row into its error, the fields that failed the check and its requestId', async ({
    page,
    mockBackend,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [ACTIVITY]: pageOf([
        entry({
          route: 'POST /client/appointments',
          pathParams: {},
          outcome: 'rejected',
          status: 422,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              body: { startTime: ['Invalid time'], 'services.0.serviceId': ['Required'] },
              query: { _root: ['Expected object'] },
            },
          },
          requestId: 'req-validation',
        }),
        entry({
          activityId: 'act-2',
          outcome: 'rejected',
          status: 409,
          error: { code: 'CONFLICT', message: 'Appointment is already cancelled', details: { status: 'CANCELLED' } },
          requestId: 'req-conflict',
        }),
        entry({ activityId: 'act-3', requestId: 'req-ok' }),
      ]),
    });
    await signIn(page, ADMIN, '/activity-log');
    await expect(page.getByTestId('activity-details')).toHaveCount(0);

    await page.getByTestId('activity-row').nth(0).click();

    const details = page.getByTestId('activity-details');
    await expect(details).toHaveCount(1);
    await expect(details.getByTestId('activity-error-code')).toHaveText('VALIDATION_ERROR');
    await expect(details.getByTestId('activity-error-message')).toHaveText('Validation failed');
    const fields = details.getByTestId('activity-validation-field');
    await expect(fields).toHaveCount(3);
    await expect(fields.nth(0)).toContainText('body · startTime');
    await expect(fields.nth(0)).toContainText('Invalid time');
    await expect(fields.nth(1)).toContainText('body · services.0.serviceId');
    await expect(fields.nth(1)).toContainText('Required');
    await expect(fields.nth(2)).toContainText('query');
    await expect(fields.nth(2)).toContainText('Expected object');
    await expect(details.getByTestId('activity-request-id')).toHaveText('req-validation');

    await details.getByTestId('activity-copy-request-id').click();

    await expect(page.getByTestId('toast')).toContainText('requestId скопійовано');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('req-validation');

    // Collapsing one row and opening another.
    await page.getByTestId('activity-row').nth(0).click();
    await expect(page.getByTestId('activity-details')).toHaveCount(0);
    await page.getByTestId('activity-row-toggle').nth(1).click();

    await expect(details.getByTestId('activity-error-code')).toHaveText('CONFLICT');
    await expect(details.getByTestId('activity-error-message')).toHaveText('Appointment is already cancelled');
    await expect(details.getByTestId('activity-validation-field')).toHaveCount(0);
    // Details that are not a failed check are shown as they came.
    await expect(details.getByTestId('activity-error-details')).toContainText('CANCELLED');
    await expect(details.getByTestId('activity-request-id')).toHaveText('req-conflict');

    // A success has no error to show — only its requestId.
    await page.getByTestId('activity-row-toggle').nth(1).click();
    await page.getByTestId('activity-row-toggle').nth(2).click();
    await expect(details.getByTestId('activity-error-code')).toHaveCount(0);
    await expect(details.getByTestId('activity-request-id')).toHaveText('req-ok');
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
      [ACTIVITY]: () => {
        calls += 1;
        if (calls === 1) {
          return first.respond();
        }
        return refuse ? apiError(500, 'INTERNAL_SERVER_ERROR') : pageOf([]);
      },
    });
    await signIn(page, ADMIN, '/activity-log');

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
