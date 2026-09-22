import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, EMPTY_STATS, expect, signIn, submitPassword, submitTotp, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

test.describe('sign-in', () => {
  test('password, then TOTP, then the shell with the email from /admin/me', async ({ page, mockBackend }) => {
    const api = await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/stats/basic': EMPTY_STATS });

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    await submitPassword(page, ADMIN.email);
    await submitTotp(page, '123456');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('admin-email')).toHaveText(ADMIN.email);
    await expect(page.getByTestId('environment-indicator')).toContainText('DEV');
    await expect(page.getByTestId('sidebar').getByRole('link')).toHaveText([
      'Дашборд',
      'Салони',
      'Незалежні майстри',
      'Клієнти',
      'Записи',
      'Відгуки',
      'Журнал дій',
    ]);
    expect(api.authorizations[0]).toMatch(/^Bearer ey/);
  });

  test('a wrong TOTP code shows an error and does not let in', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/stats/basic': EMPTY_STATS });

    await page.goto('/');
    await submitPassword(page, ADMIN.email);
    await submitTotp(page, '000000');

    await expect(page.getByTestId('login-error')).toContainText('Невірний код');
    await expect(page).toHaveURL(/\/login/);

    // The challenge is still open: the right code goes through without the password again.
    await submitTotp(page, '123456');
    await expect(page.getByTestId('admin-email')).toBeVisible();
  });

  test('returns to the address that asked for the sign-in', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME });

    // A section that reads nothing of its own: this is about the address the shell returns to.
    await signIn(page, ADMIN, '/appointments');

    await expect(page).toHaveURL(/\/appointments$/);
    await expect(page.getByTestId('section-title')).toHaveText('Записи');
  });

  test('an account with another role is refused and signed out', async ({ page, mockBackend }) => {
    const api = await mockBackend({ email: 'owner@salon.md', role: 'salon' }, {});

    await signIn(page, { email: 'owner@salon.md', role: 'salon' });

    await expect(page.getByTestId('login-error')).toContainText('не має доступу');
    await expect(page).toHaveURL(/\/login/);
    expect(api.authorizations).toEqual([]);

    // Signed out for real, not merely shown a message: the shell still asks for a sign-in.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('an account with another role and no TOTP — every real non-admin — gets the same refusal', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend({ email: 'client@mail.md', role: 'client', totp: false }, {});

    await page.goto('/');
    await submitPassword(page, 'client@mail.md');

    await expect(page.getByTestId('login-error')).toContainText('не має доступу');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('an admin token the backend refuses is signed out with the same refusal', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': apiError(403, 'FORBIDDEN') });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('login-error')).toContainText('не має доступу');
    await expect(page).toHaveURL(/\/login/);
  });

  test('an account that gets in without TOTP is refused', async ({ page, mockBackend }) => {
    await mockBackend({ ...ADMIN, totp: false }, {});

    await page.goto('/');
    await submitPassword(page, ADMIN.email);

    await expect(page.getByTestId('login-error')).toContainText('TOTP');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sign-out leaves the shell closed', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/stats/basic': EMPTY_STATS });
    await signIn(page, ADMIN);

    await page.getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/salons');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fsalons/);
  });
});
