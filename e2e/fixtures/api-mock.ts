import type { BrowserContext, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.e2e';

export type MockResponse = {
  /** Defaults to 200. */
  status?: number;
  body: unknown;
};

/** Route table keyed by `"<METHOD> <pathname>"`, e.g. `"GET /admin/me"`. */
export type MockRoutes = Record<string, MockResponse>;

export type ApiMock = {
  /** Requests that matched no entry. The app fixture asserts this is empty when a test ends. */
  readonly unmatched: string[];
  /** `Authorization` header of every matched request, in order. */
  readonly authorizations: (string | undefined)[];
};

/** Wraps a payload in the backend's success envelope. */
export function apiOk<T>(data: T): MockResponse {
  return { body: { success: true, data } };
}

/** A refusal in the backend's error envelope. */
export function apiError(status: number, code: string, message = code): MockResponse {
  return { status, body: { success: false, error: { code, message } } };
}

/**
 * Intercepts every call to `admin-api` and answers it from `routes`. An unknown path is recorded
 * and answered with 599 rather than passed through: a spec that greens on data nobody mocked is
 * worse than a red one.
 */
export async function installApiMock(context: BrowserContext, routes: MockRoutes): Promise<ApiMock> {
  const mock: ApiMock = { unmatched: [], authorizations: [] };

  await context.route(`${environment.adminApiUrl}/**`, async (route: Route): Promise<void> => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname}`;
    const entry = routes[key];

    if (entry === undefined) {
      mock.unmatched.push(key);
      await route.fulfill({
        status: 599,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNMOCKED_REQUEST', message: key } }),
      });
      return;
    }

    mock.authorizations.push(request.headers()['authorization']);
    await route.fulfill({
      status: entry.status ?? 200,
      contentType: 'application/json',
      // The app runs on another origin; without this header the browser hides the response.
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(entry.body),
    });
  });

  return mock;
}
