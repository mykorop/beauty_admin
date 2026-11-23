import type { Page, Request } from '@playwright/test';
import { environment } from '../src/environments/environment.e2e';
import { apiError, apiOk, holdResponse, type MockResponse } from './fixtures/api-mock';
import {
  ADMIN,
  EMPTY_STATS,
  NO_DETAILED_STATS,
  expect,
  signIn,
  test,
} from './fixtures/app.fixture';
import {
  exceptionOf,
  installSentryIngest,
  mechanismOf,
  SENTRY_E2E_URL,
} from './fixtures/sentry-ingest';

/** The `sub` of the mocked pool's ID token, which `GET /admin/me` answers as `adminId` too. */
const ADMIN_SUB = 'e2e-user-sub';
const ME = apiOk({ adminId: ADMIN_SUB, email: ADMIN.email });
const SERVER_ERROR = apiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
const BASIC_STATS = `${environment.adminApiUrl}/admin/stats/basic**`;

/** Answers in turn, the last one for every call after. */
function inTurn(...responses: MockResponse[]): () => MockResponse {
  let call = 0;
  return () => responses[Math.min(call++, responses.length - 1)];
}

/** Every request the page sends, to read the trace headers it carried. */
function recordRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  return requests;
}

const goesToAdminApi = (request: Request): boolean =>
  request.url().startsWith(`${environment.adminApiUrl}/`);
const goesToCognito = (request: Request): boolean =>
  new URL(request.url()).host.startsWith('cognito-idp.');
const isEnvelope = (request: Request): boolean => /\/api\/\d+\/envelope\//.test(request.url());

/** «Оновити» on the dashboard, by keyboard: the toasts of earlier refusals lie over the button. */
async function refreshDashboard(page: Page): Promise<void> {
  await page.getByTestId('dashboard-refresh').getByRole('button').press('Enter');
}

test.describe('without a DSN', () => {
  test('nothing is reported, and no trace goes out with a request', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': SERVER_ERROR,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });
    const requests = recordRequests(page);

    await signIn(page, ADMIN);
    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');

    const toAdminApi = requests.filter(goesToAdminApi);
    expect(toAdminApi.length).toBeGreaterThan(0);
    for (const request of toAdminApi) {
      expect(request.headers()['sentry-trace'], request.url()).toBeUndefined();
      expect(request.headers()['baggage'], request.url()).toBeUndefined();
    }
    expect(requests.filter(isEnvelope).map((request) => request.url())).toEqual([]);
  });
});

test.describe('with a DSN', () => {
  test.use({ baseURL: SENTRY_E2E_URL });

  test('a 5xx and a request that got no answer are events of the admin; a 4xx is not', async ({
    page,
    context,
    mockBackend,
  }) => {
    const ingest = await installSentryIngest(context);
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': inTurn(apiError(404, 'NOT_FOUND', 'Not found'), SERVER_ERROR),
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });
    const requests = recordRequests(page);

    await signIn(page, ADMIN);
    await expect(page.getByTestId('toast')).toContainText('Не знайдено.');
    await expect.poll(() => ingest.transactions).toContain('/login/');

    await refreshDashboard(page);
    // The 404 came first: had it been reported, its event would stand here before the 500's.
    await expect
      .poll(() => ingest.events.map(exceptionOf))
      .toEqual(['ApiError: Internal server error']);
    const [serverError] = ingest.events;
    expect(serverError?.user?.id).toBe(ADMIN_SUB);
    expect(serverError?.environment).toBe('dev');
    expect(serverError?.tags).toEqual(
      expect.objectContaining({ 'http.status_code': '500', 'error.code': 'INTERNAL_SERVER_ERROR' }),
    );

    await page.route(BASIC_STATS, (route) => route.abort('internetdisconnected'));
    await refreshDashboard(page);
    await expect
      .poll(() => ingest.events.map(exceptionOf))
      .toEqual(['ApiError: Internal server error', 'ApiError: Network error']);
    expect(ingest.events[1]?.tags).toEqual(
      expect.objectContaining({ 'http.status_code': '0', 'error.code': 'NETWORK_ERROR' }),
    );
    expect(ingest.events[1]?.user?.id).toBe(ADMIN_SUB);

    // The trace goes on into admin-api, whose CORS lets it through, and nowhere else.
    const toAdminApi = requests.filter(goesToAdminApi);
    expect(toAdminApi.length).toBeGreaterThan(0);
    for (const request of toAdminApi) {
      const trace = request.headers()['sentry-trace'];
      expect(trace, request.url()).toMatch(/^[0-9a-f]{32}-[0-9a-f]{16}/);
      expect(request.headers()['baggage'], request.url()).toContain('sentry-environment=dev');
    }
    const toCognito = requests.filter(goesToCognito);
    expect(toCognito.length).toBeGreaterThan(0);
    for (const request of toCognito) {
      expect(request.headers()['sentry-trace'], request.url()).toBeUndefined();
    }
  });

  test('a GET /admin/me that fails is reported as the admin’s all the same', async ({
    page,
    context,
    mockBackend,
  }) => {
    const ingest = await installSentryIngest(context);
    const me = holdResponse(SERVER_ERROR);
    await mockBackend(ADMIN, {
      'GET /admin/me': me.respond,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });

    await signIn(page, ADMIN);
    await me.requested;
    await expect.poll(() => ingest.transactions).toContain('/login/');
    await me.release();

    await expect
      .poll(() => ingest.events.map(exceptionOf))
      .toEqual(['ApiError: Internal server error']);
    expect(ingest.events[0]?.user?.id).toBe(ADMIN_SUB);
  });

  test('an error a screen throws is the admin’s event; after signing out, nobody’s', async ({
    page,
    context,
    mockBackend,
  }) => {
    const ingest = await installSentryIngest(context);
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': inTurn(
        EMPTY_STATS,
        // A shape the dashboard cannot draw: reading `salons.total` throws inside the screen.
        apiOk({ ...(EMPTY_STATS.body as { data: object }).data, salons: null }),
      ),
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });

    await signIn(page, ADMIN);
    await expect(page.getByTestId('tile-salons-total')).toBeVisible();
    await expect.poll(() => ingest.transactions).toContain('/login/');
    expect(ingest.events).toEqual([]);

    await refreshDashboard(page);
    await expect
      .poll(() => ingest.events.map(exceptionOf))
      .toEqual([expect.stringMatching(/^TypeError: .*'total'/)]);
    const [screenError] = ingest.events;
    expect(mechanismOf(screenError)).toBe('auto.function.angular.error_handler');
    expect(screenError?.user?.id).toBe(ADMIN_SUB);

    await page.getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(() => ingest.transactions).toContain('/dashboard/');
    const seen = ingest.events.length;
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('thrown after signing out');
      });
    });

    await expect
      .poll(() => ingest.events.slice(seen).map(exceptionOf))
      .toEqual(['Error: thrown after signing out']);
    expect(ingest.events[seen]?.user?.id).toBeUndefined();
  });
});

test.describe('without the Sentry organisation’s address', () => {
  // The `e2e-sentry` build has a DSN and no address: links into Sentry need the address alone.
  test.use({ baseURL: SENTRY_E2E_URL });

  test('an entry and a card lead nowhere into Sentry, and read as they did', async ({
    page,
    context,
    mockBackend,
  }) => {
    const ingest = await installSentryIngest(context);
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/activity': apiOk({
        items: [
          {
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
            outcome: 'failed',
            status: 500,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
            durationMs: 87,
            requestBody: null,
            requestBodyTruncated: false,
            client: null,
            requestId: 'req-1',
            traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
            sentryEventId: 'd3b07384d113edec49eaa6238ad5ff00',
          },
        ],
        nextCursor: null,
      }),
      'GET /admin/clients/c1': apiOk({
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
      }),
    });

    await signIn(page, ADMIN, '/activity-log');
    await page.getByTestId('activity-row-toggle').first().click();

    const details = page.getByTestId('activity-details');
    await expect(details.getByTestId('activity-error-code')).toHaveText('INTERNAL_SERVER_ERROR');
    await expect(details.getByTestId('activity-request-id')).toHaveText('req-1');
    await expect(details.getByTestId('activity-sentry')).toHaveCount(0);

    await page.goto('/clients/c1/activity');
    await expect(page.getByTestId('activity-row')).toHaveCount(1);
    await expect(page.getByTestId('activity-tab-open-log')).toBeVisible();
    await expect(page.getByTestId('activity-tab-sentry-errors')).toHaveCount(0);
    // Nor did the screen or the card throw over the missing address.
    expect(ingest.events.map(exceptionOf)).toEqual([]);
  });
});
