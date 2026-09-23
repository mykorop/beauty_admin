import { apiError, apiOk } from './fixtures/api-mock';
import {
  ADMIN,
  EMPTY_STATS,
  NO_DETAILED_STATS,
  expect,
  signIn,
  test,
} from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

test('narrow navigation opens by keyboard, closes on Escape or selection, and returns focus', async ({
  page,
  mockBackend,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(ADMIN, {
    'GET /admin/me': ME,
    'GET /admin/stats/basic': EMPTY_STATS,
    'GET /admin/stats/detailed': NO_DETAILED_STATS,
    'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
  });
  await signIn(page, ADMIN);

  const toggle = page.getByRole('button', { name: 'Навігація', exact: true });
  const navigation = page.getByTestId('sidebar');
  await expect(navigation).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link')).toHaveCount(7);
  await page.keyboard.press('Tab');
  await expect(navigation.getByRole('link').first()).toBeFocused();
  await expect(navigation.getByRole('link').first()).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();

  await page.keyboard.press('Space');
  await navigation.getByRole('link', { name: 'Журнал дій' }).click();
  await expect(page).toHaveURL(/\/audit-log$/);
  await expect(navigation).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.getByTestId('section-title')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.describe('language', () => {
  test('switches the interface and survives a reload', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });
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
    await mockBackend(ADMIN, {
      'GET /admin/me': apiError(500, 'INTERNAL_SERVER_ERROR', 'boom'),
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');
    await expect(page.getByTestId('toast')).not.toContainText('boom');
  });

  test('an unknown error code is shown as it is', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': apiError(409, 'SOME_NEW_DOMAIN_LAW', 'english prose'),
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('toast')).toContainText('SOME_NEW_DOMAIN_LAW');
  });
});

test.describe('session', () => {
  test('a session that cannot be renewed returns to the same address after signing in again', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
    });
    // A section that leaves a parameter it does not know alone: this is about the address the
    // shell returns to, not about the section.
    await signIn(page, ADMIN, '/audit-log');
    await expect(page.getByTestId('section-title')).toHaveText('Журнал дій');

    // What an expired refresh token leaves behind: no usable tokens in the browser.
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('CognitoIdentityServiceProvider.'))
        .forEach((key) => localStorage.removeItem(key));
    });
    await page.goto('/audit-log?city=Chisinau');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Faudit-log%3Fcity%3DChisinau/);

    await signIn(page, ADMIN, page.url());
    await expect(page).toHaveURL(/\/audit-log\?city=Chisinau$/);
  });
});
