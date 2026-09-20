import type { Page } from '@playwright/test';
import { apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const salon = (salonId: string, overrides: Record<string, unknown>) => ({
  salonId,
  name: salonId,
  city: 'Chișinău',
  cityCode: '0100000',
  ownerName: 'Ana Rusu',
  email: `${salonId}@bookme.md`,
  phone: '+37360000000',
  rating: 4.5,
  reviewCount: 3,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const ITEMS = [
  salon('s1', { name: 'Beauty Lab', rating: 4.9, createdAt: '2026-03-01T00:00:00.000Z' }),
  salon('s2', {
    name: 'Nails Bar',
    city: 'Bălți',
    cityCode: '0300000',
    rating: 3.1,
    phone: '+37369555000',
  }),
  salon('s3', {
    name: 'Atelier',
    status: 'blocked',
    rating: 4.0,
    createdAt: '2026-02-01T00:00:00.000Z',
  }),
  salon('s4', { name: 'Closed Doors', status: 'deleted', email: 'gone@bookme.md' }),
];

const SALONS = apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: ITEMS });

const rowNames = (page: Page) => page.getByTestId('salon-name');

/**
 * Picks an option of a PrimeNG select and waits for its overlay to leave. Without the wait the next
 * pick can land on the closing overlay's option — a click that nothing listens to any more.
 */
async function pick(page: Page, selectTestId: string, option: string): Promise<void> {
  await page.getByTestId(selectTestId).click();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

test.describe('salons list', () => {
  test('shows every salon except Deleted ones, newest first', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });

    await signIn(page, ADMIN, '/salons');

    await expect(rowNames(page)).toHaveText(['Beauty Lab', 'Atelier', 'Nails Bar']);
    await expect(page.getByTestId('salon-row').first()).toContainText('Ana Rusu');
    await expect(page.getByTestId('salon-row').nth(1).getByTestId('salon-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('salons-built-at')).toContainText('Оновлено о');
  });

  test('searches by name, email and phone, keeping the query in the address', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });
    await signIn(page, ADMIN, '/salons');

    await page.getByTestId('salons-search').fill('nails');
    await expect(rowNames(page)).toHaveText(['Nails Bar']);
    await expect(page).toHaveURL(/\/salons\?q=nails$/);

    await page.getByTestId('salons-search').fill('s3@bookme');
    await expect(rowNames(page)).toHaveText(['Atelier']);

    await page.getByTestId('salons-search').fill('69 555');
    await expect(rowNames(page)).toHaveText(['Nails Bar']);

    await page.getByTestId('salons-search').fill('');
    await expect(rowNames(page)).toHaveCount(3);
    await expect(page).toHaveURL(/\/salons$/);
  });

  test('filters by state and city; Deleted salons appear only on request, clearly marked', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });
    await signIn(page, ADMIN, '/salons');

    await pick(page, 'salons-status-filter', 'Видалений');
    await expect(rowNames(page)).toHaveText(['Closed Doors']);
    await expect(page.getByTestId('salon-row')).toHaveAttribute('data-status', 'deleted');
    await expect(page.getByTestId('salon-status')).toHaveText('Видалений');
    await expect(page).toHaveURL(/status=deleted/);

    await pick(page, 'salons-status-filter', 'Активний');
    await pick(page, 'salons-city-filter', 'Bălți');
    await expect(rowNames(page)).toHaveText(['Nails Bar']);
    await expect(page).toHaveURL(/status=active/);
    await expect(page).toHaveURL(/city=0300000/);
  });

  test('sorts by a column header, both ways', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });
    await signIn(page, ADMIN, '/salons');

    await page.getByRole('columnheader', { name: 'Рейтинг' }).click();
    await expect(rowNames(page)).toHaveText(['Nails Bar', 'Atelier', 'Beauty Lab']);
    await expect(page).toHaveURL(/sort=rating&dir=asc/);

    await page.getByRole('columnheader', { name: 'Рейтинг' }).click();
    await expect(rowNames(page)).toHaveText(['Beauty Lab', 'Atelier', 'Nails Bar']);
    await expect(page).toHaveURL(/sort=rating$/);
  });

  test('restores the whole table state from a link', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });

    await signIn(page, ADMIN, '/salons?q=a&status=blocked&sort=name&dir=asc');

    await expect(rowNames(page)).toHaveText(['Atelier']);
    await expect(page.getByTestId('salons-search')).toHaveValue('a');
    await expect(page.getByTestId('salons-status-filter')).toContainText('Заблокований');
    await expect(page.getByRole('columnheader', { name: 'Назва' })).toHaveAttribute('aria-sort', 'ascending');

    await page.reload();
    await expect(rowNames(page)).toHaveText(['Atelier']);
  });

  test('Back restores the previous search instead of re-pushing the typed one', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });
    await signIn(page, ADMIN, '/salons');
    await pick(page, 'salons-status-filter', 'Заблокований');
    await expect(rowNames(page)).toHaveText(['Atelier']);

    await page.getByTestId('salons-search').fill('zzz');
    await page.goBack();

    await expect(page).toHaveURL(/\/salons$/);
    await expect(page.getByTestId('salons-search')).toHaveValue('');
    await expect(rowNames(page)).toHaveCount(3);
  });

  test('pages in the browser and keeps the page in the address', async ({ page, mockBackend }) => {
    const many = Array.from({ length: 30 }, (_, i) => salon(`m${i}`, { name: `Salon ${String(i).padStart(2, '0')}` }));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: many }),
    });
    await signIn(page, ADMIN, '/salons?sort=name&dir=asc');
    await expect(rowNames(page)).toHaveCount(25);

    await page.getByRole('button', { name: 'Next Page' }).click();

    await expect(rowNames(page)).toHaveCount(5);
    await expect(rowNames(page).first()).toHaveText('Salon 25');
    await expect(page).toHaveURL(/page=2/);
  });

  test('"Refresh" asks the backend to rebuild the list', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': (url) =>
        url.searchParams.get('refresh') === 'true'
          ? apiOk({
              builtAt: '2026-09-20T10:07:00.000Z',
              items: [salon('s9', { name: 'Brand New' })],
            })
          : SALONS,
    });
    await signIn(page, ADMIN, '/salons');
    await expect(rowNames(page)).toHaveCount(3);
    const before = await page.getByTestId('salons-built-at').textContent();

    await page.getByTestId('salons-refresh').click();

    await expect(rowNames(page)).toHaveText(['Brand New']);
    await expect(page.getByTestId('salons-built-at')).not.toHaveText(before ?? '');
  });

  test('a click on a row opens the address of the salon card', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/salons': SALONS });
    await signIn(page, ADMIN, '/salons');

    await page.getByTestId('salon-row').first().getByText('Ana Rusu').click();

    await expect(page).toHaveURL(/\/salons\/s1$/);
  });
});
