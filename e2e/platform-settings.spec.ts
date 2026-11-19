import { apiError, apiOk, holdResponse } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const GET = 'GET /admin/settings';
const PUT = 'PUT /admin/settings/ukrainian-phones';

const settings = (overrides: Record<string, unknown> = {}) => ({
  ukrainianPhonesEnabled: false,
  updatedAt: null,
  ...overrides,
});

const checkbox = (page: import('@playwright/test').Page) =>
  page.getByTestId('ukrainian-phones').locator('input');

/**
 * «Налаштування» — the platform's own settings, today one: «Українські номери (+380)». Only the
 * Адміністратор платформи turns it on or off; every change goes through the «дія з причиною»
 * dialog, whose reason is optional here, and the page takes the settings the backend answers with.
 */
test.describe('Налаштування платформи: українські номери', () => {
  test('shows the setting as the platform has it, with what it means', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiOk(settings({ ukrainianPhonesEnabled: true, updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/settings');

    await expect(page.getByTestId('section-title')).toHaveText('Налаштування');
    await expect(page.getByText('Українські номери (+380)')).toBeVisible();
    await expect(checkbox(page)).toBeChecked();
    await expect(checkbox(page)).toBeEnabled();
    const hint = page.getByTestId('ukrainian-phones-hint');
    await expect(hint).toContainText('+380');
    await expect(hint).toContainText('14 разів дорожчі');
    await expect(hint).toContainText('вже збережені номери лишаються');
    await expect(hint).toContainText('dev і staging');
    await expect(hint).toContainText('prod');
    await expect(
      page.getByTestId('sidebar').getByRole('link', { name: 'Налаштування' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('turning it on asks for an optional reason, sends PUT and the page takes the answer', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiOk(settings()),
      [PUT]: apiOk(settings({ ukrainianPhonesEnabled: true, updatedAt: '2026-09-21T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/settings');
    await expect(checkbox(page)).not.toBeChecked();

    await checkbox(page).click();

    const dialog = page.getByTestId('reason-dialog');
    await expect(dialog).toContainText('+380');
    await expect(dialog).toContainText('14 разів дорожчі');
    await expect(dialog).toContainText('Причина (необов’язково)');
    // No reason is owed: confirming with the field left blank is allowed.
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-confirm').click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Українські номери увімкнено.')).toBeVisible();
    // The page shows the settings the backend answered with.
    await expect(checkbox(page)).toBeChecked();
    expect(mock.bodies[PUT]).toEqual([{ enabled: true }]);
  });

  test('turning it off sends the reason typed', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiOk(settings({ ukrainianPhonesEnabled: true, updatedAt: '2026-09-21T10:00:00.000Z' })),
      [PUT]: apiOk(settings({ ukrainianPhonesEnabled: false, updatedAt: '2026-09-22T10:00:00.000Z' })),
    });
    await signIn(page, ADMIN, '/settings');

    await checkbox(page).click();
    const dialog = page.getByTestId('reason-dialog');
    await expect(dialog).toContainText('більше не пропонуватимуть +380');
    await expect(dialog).toContainText('Уже збережені номери лишаються');
    await page.getByTestId('reason-input').fill('  Too expensive this month ');
    await page.getByTestId('reason-confirm').click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Українські номери вимкнено.')).toBeVisible();
    await expect(checkbox(page)).not.toBeChecked();
    expect(mock.bodies[PUT]).toEqual([{ enabled: false, reason: 'Too expensive this month' }]);
  });

  test('cancelling sends nothing and puts the checkbox back', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiOk(settings()),
    });
    await signIn(page, ADMIN, '/settings');

    await checkbox(page).click();
    await expect(checkbox(page)).toBeChecked();
    await page.getByTestId('reason-cancel').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(checkbox(page)).not.toBeChecked();
    expect(mock.bodies[PUT]).toBeUndefined();
  });

  test('keeps the dialog open when the backend refuses, and the setting as it was', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiOk(settings()),
      [PUT]: apiError(500, 'INTERNAL_SERVER_ERROR'),
    });
    await signIn(page, ADMIN, '/settings');

    await checkbox(page).click();
    await page.getByTestId('reason-input').fill('Agreed with sms.md');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері');
    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Agreed with sms.md');
    await page.getByTestId('reason-cancel').click();
    await expect(checkbox(page)).not.toBeChecked();
  });

  test('the Журнал дій names the change and leads back to this page', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/audit': (url) => {
        seen.push(url.searchParams);
        return apiOk({
          items: [
            {
              auditId: 'a1',
              adminId: 'e2e-user-sub',
              adminEmail: ADMIN.email,
              targetType: 'platform',
              targetId: 'settings',
              salonId: null,
              action: 'platform.ukrainian_phones.update',
              createdAt: '2026-09-21T10:00:00.000Z',
              changes: [{ field: 'ukrainianPhonesEnabled', before: false, after: true }],
              reason: 'Launch in Ukraine',
              affected: [],
            },
          ],
          nextCursor: null,
        });
      },
      [GET]: apiOk(settings({ ukrainianPhonesEnabled: true })),
    });
    await signIn(page, ADMIN, '/audit-log?targetType=platform&action=platform.ukrainian_phones.update');

    // Both filters are understood, not dropped as a hand-edited mistake.
    await expect(page.getByTestId('audit-filter-target-type')).toContainText('Платформа');
    await expect(page.getByTestId('audit-filter-action')).toContainText(
      'Зміна налаштування «Українські номери»',
    );
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({
      targetType: 'platform',
      action: 'platform.ukrainian_phones.update',
    });

    const row = page.getByTestId('audit-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Зміна налаштування «Українські номери»');
    await expect(row).toContainText('Платформа');
    await row.click();
    const change = page.getByTestId('audit-details').getByTestId('history-change');
    await expect(change).toContainText('Українські номери (+380)');
    await expect(change).toContainText('ні');
    await expect(change).toContainText('так');
    await expect(page.getByTestId('history-reason')).toContainText('Launch in Ukraine');

    await page.getByTestId('audit-target').click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(checkbox(page)).toBeChecked();
  });

  test('says it is loading until the settings arrive', async ({ page, mockBackend }) => {
    const held = holdResponse(apiOk(settings({ ukrainianPhonesEnabled: true })));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: () => held.respond(),
    });
    await signIn(page, ADMIN, '/settings');
    await held.requested;

    await expect(page.getByTestId('settings-loading')).toBeVisible();
    await expect(page.getByTestId('ukrainian-phones')).toHaveCount(0);

    await held.release();
    await expect(page.getByTestId('settings-loading')).toHaveCount(0);
    await expect(checkbox(page)).toBeChecked();
  });

  test('says so when the settings cannot be read, and offers nothing to change', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [GET]: apiError(500, 'INTERNAL_SERVER_ERROR'),
    });
    await signIn(page, ADMIN, '/settings');

    await expect(page.getByTestId('settings-failed')).toBeVisible();
    await expect(page.getByTestId('ukrainian-phones')).toHaveCount(0);
  });
});
