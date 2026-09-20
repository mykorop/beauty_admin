import { expect, type Page, test as base } from '@playwright/test';
import { type ApiMock, installApiMock, type MockRoutes } from './api-mock';
import { type CognitoAccount, installCognitoMock, VALID_TOTP } from './cognito-mock';

export const ADMIN: CognitoAccount = { email: 'admin@bookme.md', role: 'admin' };

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
