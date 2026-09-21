import type { Page } from '@playwright/test';
import { apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const master = (masterId: string, overrides: Record<string, unknown>) => ({
  masterId,
  name: masterId,
  city: 'Chișinău',
  cityCode: '0100000',
  specialization: 'barber',
  email: `${masterId}@bookme.md`,
  phone: '+37360000000',
  rating: 4.5,
  reviewCount: 3,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const ITEMS = [
  master('m1', { name: 'Ion Popa', rating: 4.9, createdAt: '2026-03-01T00:00:00.000Z' }),
  master('m2', {
    name: 'Ana Rusu',
    city: 'Bălți',
    cityCode: '0300000',
    specialization: 'nail_specialist',
    rating: 3.1,
    phone: '+37369555000',
  }),
  master('m3', {
    name: 'Vasile Ciobanu',
    status: 'blocked',
    // Its label sorts *after* nail_specialist in Ukrainian, while its code sorts before it.
    specialization: 'hair_specialist',
    rating: 4.0,
    createdAt: '2026-02-01T00:00:00.000Z',
  }),
  master('m4', { name: 'Gone Master', status: 'deleted', email: 'gone@bookme.md' }),
];

const MASTERS = apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: ITEMS });

const rowNames = (page: Page) => page.getByTestId('master-name');

/** Picks an option of a PrimeNG select and waits for its overlay to leave. */
async function pick(page: Page, selectTestId: string, option: string): Promise<void> {
  await page.getByTestId(selectTestId).click();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

test.describe('independent masters list', () => {
  test('shows every master except Deleted ones, newest first, with translated specializations', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters': MASTERS });

    await signIn(page, ADMIN, '/independent-masters');

    await expect(page.getByTestId('section-title')).toHaveText('Незалежні майстри');
    await expect(rowNames(page)).toHaveText(['Ion Popa', 'Vasile Ciobanu', 'Ana Rusu']);
    await expect(page.getByTestId('master-row').first()).toContainText('Барбер');
    await expect(page.getByTestId('master-row').nth(1).getByTestId('master-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('masters-built-at')).toContainText('Оновлено о');
  });

  test('searches by name, email and phone, keeping the query in the address', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters': MASTERS });
    await signIn(page, ADMIN, '/independent-masters');

    await page.getByTestId('masters-search').fill('ana');
    await expect(rowNames(page)).toHaveText(['Ana Rusu']);
    await expect(page).toHaveURL(/\/independent-masters\?q=ana$/);

    await page.getByTestId('masters-search').fill('m3@bookme');
    await expect(rowNames(page)).toHaveText(['Vasile Ciobanu']);

    await page.getByTestId('masters-search').fill('69 555');
    await expect(rowNames(page)).toHaveText(['Ana Rusu']);

    await page.getByTestId('masters-search').fill('');
    await expect(rowNames(page)).toHaveCount(3);
  });

  test('filters by state and city; Deleted masters appear only on request, clearly marked', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters': MASTERS });
    await signIn(page, ADMIN, '/independent-masters');

    await pick(page, 'masters-status-filter', 'Видалений');
    await expect(rowNames(page)).toHaveText(['Gone Master']);
    await expect(page.getByTestId('master-row')).toHaveAttribute('data-status', 'deleted');
    await expect(page).toHaveURL(/status=deleted/);

    await pick(page, 'masters-status-filter', 'Активний');
    await pick(page, 'masters-city-filter', 'Bălți');
    await expect(rowNames(page)).toHaveText(['Ana Rusu']);
    await expect(page).toHaveURL(/city=0300000/);
  });

  test('sorts by a column header and restores the whole state from a link', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters': MASTERS });
    await signIn(page, ADMIN, '/independent-masters');

    await page.getByRole('columnheader', { name: 'Рейтинг' }).click();
    await expect(rowNames(page)).toHaveText(['Ana Rusu', 'Vasile Ciobanu', 'Ion Popa']);
    await expect(page).toHaveURL(/sort=rating&dir=asc/);

    await page.reload();
    await expect(rowNames(page)).toHaveText(['Ana Rusu', 'Vasile Ciobanu', 'Ion Popa']);
    await expect(page.getByRole('columnheader', { name: 'Рейтинг' })).toHaveAttribute('aria-sort', 'ascending');
  });

  test('sorts «Спеціалізація» by the translated label, not by the stored code', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/masters': MASTERS });
    await signIn(page, ADMIN, '/independent-masters');

    await page.getByRole('columnheader', { name: 'Спеціалізація' }).click();

    // Барбер < Майстер нігтьового сервісу < Спеціаліст з волосся — what the reader sees decides.
    // By the stored codes it would be barber < hair_specialist < nail_specialist, i.e. m1, m3, m2.
    await expect(rowNames(page)).toHaveText(['Ion Popa', 'Ana Rusu', 'Vasile Ciobanu']);
    await expect(page).toHaveURL(/sort=specialization&dir=asc/);
  });

  test('pages in the browser and keeps the page in the address', async ({ page, mockBackend }) => {
    const many = Array.from({ length: 30 }, (_, i) =>
      master(`x${i}`, { name: `Master ${String(i).padStart(2, '0')}` }),
    );
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters': apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: many }),
    });
    await signIn(page, ADMIN, '/independent-masters?sort=name&dir=asc');
    await expect(rowNames(page)).toHaveCount(25);

    await page.getByRole('button', { name: 'Next Page' }).click();

    await expect(rowNames(page)).toHaveCount(5);
    await expect(rowNames(page).first()).toHaveText('Master 25');
    await expect(page).toHaveURL(/page=2/);
  });

  test('"Refresh" asks the backend to rebuild the list', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters': (url) =>
        url.searchParams.get('refresh') === 'true'
          ? apiOk({ builtAt: '2026-09-20T10:07:00.000Z', items: [master('m9', { name: 'Brand New' })] })
          : MASTERS,
    });
    await signIn(page, ADMIN, '/independent-masters');
    await expect(rowNames(page)).toHaveCount(3);

    await page.getByTestId('masters-refresh').click();

    await expect(rowNames(page)).toHaveText(['Brand New']);
  });

  test('a click on a row opens the master card', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters': MASTERS,
      // The card's own fields are `master-card.spec.ts`'s business; here it only has to open.
      'GET /admin/masters/m1': apiOk({
        masterId: 'm1',
        name: 'Ion Popa',
        status: 'active',
        timezone: 'Europe/Chisinau',
        shortLinks: { random: null, handle: null },
        salon: null,
      }),
    });
    await signIn(page, ADMIN, '/independent-masters');

    await page.getByTestId('master-row').first().getByText('Барбер').click();

    await expect(page).toHaveURL(/\/independent-masters\/m1\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
  });

  test('the sidebar leads here', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters': MASTERS,
      'GET /admin/salons': apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: [] }),
    });
    await signIn(page, ADMIN, '/salons');

    await page.getByTestId('sidebar').getByRole('link', { name: 'Незалежні майстри' }).click();

    await expect(page).toHaveURL(/\/independent-masters$/);
    await expect(rowNames(page)).toHaveCount(3);
  });
});
