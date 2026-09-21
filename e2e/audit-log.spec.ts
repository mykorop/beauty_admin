import { apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const AUDIT = 'GET /admin/audit';

const auditEntry = (overrides: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: ADMIN.email,
  targetType: 'salon',
  targetId: 's1',
  salonId: 's1',
  action: 'salon.profile.update',
  createdAt: '2026-09-21T10:00:00.000Z',
  changes: [
    { field: 'phone', before: '+37360000001', after: '+37360000002' },
    { field: 'brandColor', before: null, after: '#aa3366' },
  ],
  reason: 'Owner asked by phone',
  affected: [],
  ...overrides,
});

test.describe('audit log screen', () => {
  // The log runs on the platform's clock, wherever the browser is.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('lists every action, newest first as served, on the platform’s clock', async ({ page, mockBackend }) => {
    const seen: string[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) => {
        seen.push(url.search);
        return apiOk({
          items: [auditEntry(), auditEntry({ auditId: 'a2', targetId: 's2', createdAt: '2026-09-20T08:30:00.000Z' })],
          nextCursor: null,
        });
      },
    });

    await signIn(page, ADMIN, '/audit-log');

    await expect(page.getByTestId('section-title')).toHaveText('Журнал дій');
    const rows = page.getByTestId('audit-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Зміна профілю');
    await expect(rows.nth(0)).toContainText(ADMIN.email);
    // 10:00Z is 13:00 in Chișinău in September.
    await expect(rows.nth(0)).toContainText('13:00');
    await expect(rows.nth(1)).toContainText('11:30');
    await expect(page.getByTestId('audit-more')).toHaveCount(0);
    // The whole log: no target, no filters.
    expect(seen).toEqual(['']);
  });

  test('sends the filters to the backend and keeps them in the address', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: url.searchParams.has('action') ? [auditEntry()] : [], nextCursor: null });
      },
    });
    await signIn(page, ADMIN, '/audit-log');
    await expect(page.getByTestId('audit-empty')).toBeVisible();

    await page.getByTestId('audit-filter-from').fill('2026-09-01');
    await page.getByTestId('audit-filter-to').fill('2026-09-21');
    await page.getByTestId('audit-filter-target-type').click();
    await page.getByRole('option', { name: 'Салон' }).click();
    await page.getByTestId('audit-filter-action').click();
    // Exact: «Зміна профілю Майстра» is another action of the same list.
    await page.getByRole('option', { name: 'Зміна профілю', exact: true }).click();

    await expect(page.getByTestId('audit-row')).toHaveCount(1);
    await expect(page).toHaveURL(/from=2026-09-01/);
    await expect(page).toHaveURL(/to=2026-09-21/);
    await expect(page).toHaveURL(/targetType=salon/);
    await expect(page).toHaveURL(/action=salon\.profile\.update/);
    // Whole days on Chișinău's clock, the last one included — not on the browser's.
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-21T21:00:00.000Z',
      targetType: 'salon',
      action: 'salon.profile.update',
    });

    await page.getByTestId('audit-filter-reset').click();

    await expect(page.getByTestId('audit-empty')).toBeVisible();
    await expect(page).toHaveURL(/\/audit-log$/);
    expect([...seen.at(-1)!.keys()]).toEqual([]);
  });

  test('reopens a copied link with the same filters', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: [auditEntry()], nextCursor: null });
      },
    });

    await signIn(page, ADMIN, '/audit-log?from=2026-09-21&action=salon.profile.update');

    await expect(page.getByTestId('audit-row')).toHaveCount(1);
    await expect(page.getByTestId('audit-filter-from')).toHaveValue('2026-09-21');
    await expect(page.getByTestId('audit-filter-action')).toContainText('Зміна профілю');
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({
      from: '2026-09-20T21:00:00.000Z',
      action: 'salon.profile.update',
    });
  });

  test('loads older entries on demand, under the same filters', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) => {
        seen.push(url.searchParams);
        return url.searchParams.get('cursor') === 'next-1'
          ? apiOk({ items: [auditEntry({ auditId: 'a2' })], nextCursor: null })
          : apiOk({ items: [auditEntry()], nextCursor: 'next-1' });
      },
    });
    await signIn(page, ADMIN, '/audit-log?targetType=salon');

    await expect(page.getByTestId('audit-row')).toHaveCount(1);
    await page.getByTestId('audit-more').click();

    await expect(page.getByTestId('audit-row')).toHaveCount(2);
    await expect(page.getByTestId('audit-more')).toHaveCount(0);
    expect(Object.fromEntries(seen.at(-1)!)).toEqual({ targetType: 'salon', cursor: 'next-1' });
  });

  test('starts over when a filter changes after paging', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) =>
        url.searchParams.has('cursor')
          ? apiOk({ items: [auditEntry({ auditId: 'a2' })], nextCursor: null })
          : apiOk({ items: [auditEntry()], nextCursor: 'next-1' }),
    });
    await signIn(page, ADMIN, '/audit-log');
    await page.getByTestId('audit-more').click();
    await expect(page.getByTestId('audit-row')).toHaveCount(2);

    await page.getByTestId('audit-filter-from').fill('2026-09-01');

    await expect(page.getByTestId('audit-row')).toHaveCount(1);
    await expect(page.getByTestId('audit-more')).toBeVisible();
  });

  test('expands a row into its field diff and reason', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: apiOk({ items: [auditEntry(), auditEntry({ auditId: 'a2', reason: null })], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/audit-log');
    await expect(page.getByTestId('audit-details')).toHaveCount(0);

    await page.getByTestId('audit-row').nth(0).click();

    const details = page.getByTestId('audit-details');
    await expect(details).toHaveCount(1);
    const changes = details.getByTestId('history-change');
    await expect(changes).toHaveCount(2);
    await expect(changes.nth(0)).toContainText('Телефон');
    await expect(changes.nth(0)).toContainText('+37360000001');
    await expect(changes.nth(0)).toContainText('+37360000002');
    await expect(changes.nth(1)).toContainText('Колір бренду');
    await expect(details.getByTestId('history-reason')).toContainText('Owner asked by phone');
    await expect(details.getByTestId('history-affected')).toHaveCount(0);

    await page.getByTestId('audit-row').nth(0).click();
    await expect(page.getByTestId('audit-details')).toHaveCount(0);
  });

  test('lists what a bulk action touched', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: apiOk({
        items: [
          auditEntry({
            changes: [],
            reason: 'Salon closed',
            affected: [
              { type: 'appointment', id: 'appt-1' },
              { type: 'appointment', id: 'appt-2' },
            ],
          }),
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/audit-log');

    await page.getByTestId('audit-row-toggle').click();

    const affected = page.getByTestId('history-affected-entity');
    await expect(affected).toHaveCount(2);
    await expect(affected.nth(0)).toContainText('Запис appt-1');
    await expect(page.getByTestId('history-change')).toHaveCount(0);
  });

  test('opens the target’s card from its link without expanding the row', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: apiOk({ items: [auditEntry()], nextCursor: null }),
      'GET /admin/salons/s1': { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } },
    });
    await signIn(page, ADMIN, '/audit-log');

    await page.getByTestId('audit-target').click();

    await expect(page).toHaveURL(/\/salons\/s1/);
  });

  test('words a Майстер салону edit and links it to his card inside the salon', async ({ page, mockBackend }) => {
    const notFound = { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'x' } } };
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: apiOk({
        items: [
          auditEntry({
            targetType: 'master',
            targetId: 'm2',
            action: 'salon.master.update',
            changes: [
              { field: 'specialization', before: 'barber', after: 'cosmetologist' },
              { field: 'commissionPercent', before: 40, after: 50 },
            ],
          }),
        ],
        nextCursor: null,
      }),
      'GET /admin/salons/s1': notFound,
      'GET /admin/salons/s1/masters/m2': notFound,
    });
    await signIn(page, ADMIN, '/audit-log');

    const row = page.getByTestId('audit-row').first();
    await expect(row).toContainText('Зміна даних Майстра салону');
    await row.click();
    const changes = page.getByTestId('history-change');
    await expect(changes.nth(0)).toContainText('Спеціалізація');
    await expect(changes.nth(0)).toContainText('Барбер');
    await expect(changes.nth(0)).toContainText('Косметолог');
    await expect(changes.nth(1)).toContainText('Комісія');

    await page.getByTestId('audit-target').click();

    await expect(page).toHaveURL(/\/salons\/s1\/masters\/m2/);
  });
});
