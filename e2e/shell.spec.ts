import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

test.describe('language', () => {
  test('switches the interface and survives a reload', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME });
    await signIn(page, ADMIN);
    const salons = page.getByTestId('sidebar').getByRole('link').nth(1);
    await expect(salons).toHaveText('Салони');

    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();
    await expect(salons).toHaveText('Saloane');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

    await page.reload();
    await expect(salons).toHaveText('Saloane');

    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Русский' }).click();
    await expect(salons).toHaveText('Салоны');
  });
});

test.describe('backend refusals', () => {
  test('a known error code is shown in the interface language', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': apiError(500, 'INTERNAL_SERVER_ERROR', 'boom') });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');
    await expect(page.getByTestId('toast')).not.toContainText('boom');
  });

  test('an unknown error code is shown as it is', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': apiError(409, 'SOME_NEW_DOMAIN_LAW', 'english prose') });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('toast')).toContainText('SOME_NEW_DOMAIN_LAW');
  });
});

test.describe('session', () => {
  test('a session that cannot be renewed returns to the same address after signing in again', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME });
    await signIn(page, ADMIN, '/clients');
    await expect(page.getByTestId('section-title')).toHaveText('Клієнти');

    // What an expired refresh token leaves behind: no usable tokens in the browser.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('CognitoIdentityServiceProvider.'))
        .forEach((key) => localStorage.removeItem(key));
    });
    await page.goto('/clients?city=Chisinau');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fclients%3Fcity%3DChisinau/);

    await signIn(page, ADMIN, page.url());
    await expect(page).toHaveURL(/\/clients\?city=Chisinau$/);
  });
});
