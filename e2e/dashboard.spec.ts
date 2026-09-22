import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const counts = (total: number, active: number, blocked: number, deleted: number) => ({
  total,
  active,
  blocked,
  deleted,
});

const STATS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  salons: counts(4, 2, 1, 1),
  independentMasters: counts(3, 3, 0, 0),
  salonMasters: counts(7, 5, 1, 1),
  clients: counts(12, 11, 1, 0),
});

const salon = (salonId: string, overrides: Record<string, unknown> = {}) => ({
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

/** The very four Салони the stats above counted, so a tile's figure can be checked against a list. */
const SALONS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  items: [
    salon('s1', { name: 'Beauty Lab' }),
    salon('s2', { name: 'Nails Bar' }),
    salon('s3', { name: 'Atelier', status: 'blocked' }),
    salon('s4', { name: 'Closed Doors', status: 'deleted' }),
  ],
});

const client = (clientId: string, overrides: Record<string, unknown> = {}) => ({
  clientId,
  name: clientId,
  email: `${clientId}@bookme.md`,
  phone: '+37360000000',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const CLIENTS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  items: [client('c1'), client('c2', { status: 'blocked' })],
});

test.describe('dashboard', () => {
  test('is where signing in lands, with the counters and when they were built', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/stats/basic': STATS });

    await signIn(page, ADMIN);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId('section-title')).toHaveText('Дашборд');
    await expect(page.getByTestId('tile-salons-total')).toContainText('4');
    await expect(page.getByTestId('tile-salons-active')).toContainText('2');
    await expect(page.getByTestId('tile-salons-blocked')).toContainText('1');
    await expect(page.getByTestId('tile-salons-deleted')).toContainText('1');
    await expect(page.getByTestId('dashboard-group-independentMasters')).toContainText('Незалежні майстри');
    await expect(page.getByTestId('tile-clients-total')).toContainText('12');
    await expect(page.getByTestId('dashboard-built-at')).toContainText('Оновлено о');
  });

  test('a tile opens its list filtered to exactly what it counted', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': STATS,
      'GET /admin/salons': SALONS,
    });
    await signIn(page, ADMIN);

    await page.getByTestId('tile-salons-blocked').click();

    await expect(page).toHaveURL(/\/salons\?status=blocked$/);
    await expect(page.getByTestId('salon-name')).toHaveText(['Atelier']);
    await expect(page.getByTestId('salons-status-filter')).toContainText('Заблокований');
  });

  test('«усього» opens the list showing Видалені too, so the figure matches the rows', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': STATS,
      'GET /admin/salons': SALONS,
    });
    await signIn(page, ADMIN);

    await page.getByTestId('tile-salons-total').click();

    await expect(page).toHaveURL(/\/salons\?status=all$/);
    await expect(page.getByTestId('salon-name')).toHaveCount(4);
    await expect(page.getByTestId('salons-total')).toContainText('4');
  });

  test('a Клієнти tile opens the Клієнти table, not the Салони one', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': STATS,
      'GET /admin/clients': CLIENTS,
    });
    await signIn(page, ADMIN);

    await page.getByTestId('tile-clients-blocked').click();

    await expect(page).toHaveURL(/\/clients\?status=blocked$/);
    await expect(page.getByTestId('client-name')).toHaveText(['c2']);
  });

  test('Майстри салону are counted but not clickable: the panel has no list of them', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/stats/basic': STATS });
    await signIn(page, ADMIN);

    await expect(page.getByTestId('tile-salonMasters-total')).toContainText('7');
    await expect(page.getByTestId('tile-salonMasters-total')).not.toHaveRole('link');
    await expect(page.getByTestId('dashboard-hint-salonMasters')).toContainText('Ростері');
    await expect(page.getByTestId('dashboard-hint-salons')).toHaveCount(0);
  });

  test('«Оновити» asks the backend to rebuild the listings behind the counters', async ({ page, mockBackend }) => {
    let served = 0;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': (url) =>
        url.searchParams.get('refresh') === 'true'
          ? apiOk({
              builtAt: '2026-09-20T11:00:00.000Z',
              salons: counts(5, 3, 1, 1),
              independentMasters: counts(3, 3, 0, 0),
              salonMasters: counts(7, 5, 1, 1),
              clients: counts(12, 11, 1, 0),
            })
          : (served++, STATS),
    });
    await signIn(page, ADMIN);
    await expect(page.getByTestId('tile-salons-total')).toContainText('4');

    await page.getByTestId('dashboard-refresh').click();

    await expect(page.getByTestId('tile-salons-total')).toContainText('5');
    expect(served).toBe(1);
    expect(mock.unmatched).toEqual([]);
  });

  test('a refusal leaves the screen readable and the toast worded', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': apiError(500, 'INTERNAL_SERVER_ERROR', 'boom'),
    });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('dashboard-empty')).toContainText('Не вдалося завантажити показники');
    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');
  });
});
