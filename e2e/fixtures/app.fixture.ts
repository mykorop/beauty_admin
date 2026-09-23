import { expect, type Page, test as base } from '@playwright/test';
import { apiOk, type ApiMock, installApiMock, type MockResponse, type MockRoutes } from './api-mock';
import { type CognitoAccount, installCognitoMock, VALID_TOTP } from './cognito-mock';

export const ADMIN: CognitoAccount = { email: 'admin@bookme.md', role: 'admin' };

const NO_PROFILES = { total: 0, active: 0, blocked: 0, deleted: 0 };

/**
 * Базові показники with nothing on the platform.
 *
 * Signing in lands on the dashboard, so every spec that signs in at the default address loads it,
 * whatever the spec is really about. A spec still has to name this route itself — an unmocked call
 * stays an unmocked call — but one about the shell or the sign-in form need not invent figures.
 */
export const EMPTY_STATS: MockResponse = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  salons: NO_PROFILES,
  independentMasters: NO_PROFILES,
  salonMasters: NO_PROFILES,
  clients: NO_PROFILES,
});

/**
 * Детальна статистика never computed: no run, no result. The dashboard asks for its state on every
 * landing, so a spec that signs in at the default address names this route beside `EMPTY_STATS`.
 */
export const NO_DETAILED_STATS: MockResponse = apiOk({ run: null, result: null });

type AppFixtures = {
  /** Installs both mocks. Call before the first navigation. */
  mockBackend: (account: CognitoAccount, routes: MockRoutes) => Promise<ApiMock>;
};

export const test = base.extend<AppFixtures>({
  mockBackend: async ({ context }, use) => {
    const mocks: ApiMock[] = [];

    await use(async (account, routes) => {
      await installCognitoMock(context, account);
      const mock = await installApiMock(context, routes);
      mocks.push(mock);
      return mock;
    });

    for (const mock of mocks) {
      expect(mock.unmatched, 'requests to admin-api that the spec did not mock').toEqual([]);
    }
  },
});

export { expect };

export async function submitPassword(page: Page, email: string): Promise<void> {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').locator('input').fill('correct-horse-battery');
  await page.getByTestId('login-submit').click();
}

export async function submitTotp(page: Page, code: string): Promise<void> {
  // PrimeNG's OTP field is one input per digit; typing into the first one walks through the rest.
  await page.getByTestId('login-totp').locator('input').first().click();
  await page.keyboard.type(code);
  await page.getByTestId('login-totp-submit').click();
}

/** Signs in through the real form, TOTP step included. */
export async function signIn(page: Page, account: CognitoAccount, path = '/'): Promise<void> {
  await page.goto(path);
  await submitPassword(page, account.email);
  await submitTotp(page, VALID_TOTP);
}
