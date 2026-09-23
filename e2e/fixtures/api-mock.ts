import type { BrowserContext, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.e2e';

export type MockResponse = {
  /** Defaults to 200. */
  status?: number;
  body: unknown;
  /** Told once the answer has been handed to the browser, or the app no longer waited for it. */
  delivered?: () => void;
};

/**
 * Route table keyed by `"<METHOD> <pathname>"`, e.g. `"GET /admin/me"`. A function entry answers
 * from the request's URL and JSON body — for an endpoint whose response depends on either, or
 * changes from one call to the next — and may answer later than at once (`holdResponse`).
 */
export type MockRoutes = Record<
  string,
  MockResponse | ((url: URL, body: unknown) => MockResponse | Promise<MockResponse>)
>;

export type ApiMock = {
  /** Requests that matched no entry. The app fixture asserts this is empty when a test ends. */
  readonly unmatched: string[];
  /** `Authorization` header of every matched request, in order. */
  readonly authorizations: (string | undefined)[];
  /** JSON body of every matched request under its route key, in order — what the app really sent. */
  readonly bodies: Record<string, unknown[]>;
};

/** Wraps a payload in the backend's success envelope. */
export function apiOk<T>(data: T): MockResponse {
  return { body: { success: true, data } };
}

/** A refusal in the backend's error envelope. */
export function apiError(status: number, code: string, message = code, details?: unknown): MockResponse {
  return { status, body: { success: false, error: { code, message, ...(details === undefined ? {} : { details }) } } };
}

/** An answer the spec lets go of itself: see `holdResponse`. */
export type HeldResponse = {
  /** The route entry, or what a function entry returns for the call it holds. */
  readonly respond: () => Promise<MockResponse>;
  /** Settles once the app's request has reached the mock. */
  readonly requested: Promise<void>;
  /**
   * Lets the answer go. Settles once the browser has it — or once the mock knows the app no longer
   * waits for it, which a spec about late answers cannot tell apart and need not.
   */
  release(): Promise<void>;
};

/**
 * Holds an answer until the spec releases it, so it lands after whatever the spec does meanwhile
 * — another card opened, another request answered first. Deterministic: nothing waits on a clock.
 */
export function holdResponse(response: MockResponse): HeldResponse {
  let arrive!: () => void;
  let letGo!: () => void;
  let deliver!: () => void;
  const requested = new Promise<void>((resolve) => (arrive = resolve));
  const released = new Promise<void>((resolve) => (letGo = resolve));
  const delivered = new Promise<void>((resolve) => (deliver = resolve));
  return {
    requested,
    respond: async () => {
      arrive();
      await released;
      return { ...response, delivered: deliver };
    },
    release: () => {
      letGo();
      return delivered;
    },
  };
}

/**
 * Intercepts every call to `admin-api` and answers it from `routes`. An unknown path is recorded
 * and answered with 599 rather than passed through: a spec that greens on data nobody mocked is
 * worse than a red one.
 */
export async function installApiMock(context: BrowserContext, routes: MockRoutes): Promise<ApiMock> {
  const mock: ApiMock = { unmatched: [], authorizations: [], bodies: {} };

  await context.route(`${environment.adminApiUrl}/**`, async (route: Route): Promise<void> => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    const matched = routes[key];

    if (matched === undefined) {
      mock.unmatched.push(key);
      await route.fulfill({
        status: 599,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNMOCKED_REQUEST', message: key } }),
      });
      return;
    }

    const body: unknown = request.postDataJSON();
    mock.authorizations.push(request.headers()['authorization']);
    (mock.bodies[key] ??= []).push(body);
    const entry = typeof matched === 'function' ? await matched(url, body) : matched;
    try {
      await route.fulfill({
        status: entry.status ?? 200,
        contentType: 'application/json',
        // The app runs on another origin; without this header the browser hides the response.
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(entry.body),
      });
    } finally {
      entry.delivered?.();
    }
  });

  return mock;
}
