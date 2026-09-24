import type { Page } from '@playwright/test';
import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';
import { expectEveryAction, expectOnlyCancellation } from './fixtures/appointment-offers';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

const BLOCKED = { blockedAt: '2026-09-22T08:00:00.000Z', blockedReason: 'Repeated no-shows' };

const listItem = (clientId: string, overrides: Record<string, unknown> = {}) => ({
  clientId,
  name: clientId,
  email: `${clientId}@bookme.md`,
  phone: '+37360000000',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const ITEMS = [
  listItem('c1', { name: 'Maria Rusu', createdAt: '2026-03-01T00:00:00.000Z' }),
  listItem('c2', { name: 'Ion Popa', phone: '+37369555000' }),
  listItem('c3', { name: 'Vasile Ciobanu', status: 'blocked', createdAt: '2026-02-01T00:00:00.000Z' }),
  listItem('c4', { name: 'Gone Client', status: 'deleted', email: 'gone@bookme.md' }),
];

const CLIENTS = apiOk({ builtAt: '2026-09-20T10:00:00.000Z', items: ITEMS });

const client = (overrides: Record<string, unknown> = {}) => ({
  clientId: 'c1',
  name: 'Maria Rusu',
  firstName: 'Maria',
  lastName: 'Rusu',
  email: 'maria@bookme.md',
  phone: '+37360000001',
  avatarUrl: '',
  language: 'uk',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const appointment = (overrides: Record<string, unknown> = {}) => ({
  appointmentId: 'a1',
  startTime: '2026-10-05T07:00:00.000Z',
  endTime: '2026-10-05T07:45:00.000Z',
  status: 'BOOKED',
  clientName: 'Maria Rusu',
  masterId: 'm1',
  masterName: 'Ion Popa',
  salonId: 's1',
  serviceNames: ['Стрижка'],
  totalPrice: 350,
  currency: 'MDL',
  isManual: false,
  venueName: 'Beauty Lab',
  timezone: 'Europe/Chisinau',
  ...overrides,
});

/** The card of a Запис as it opens under its row — the Місце it was made in may be changed. */
const details = (row: ReturnType<typeof appointment>, overrides: Record<string, unknown> = {}) => ({
  ...row,
  updatedAt: '2026-09-20T10:00:00.000Z',
  clientId: 'c1',
  clientPhone: '+37360000001',
  salonName: row.salonId ? row.venueName : null,
  venueStatus: 'active',
  services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
  totalDurationMinutes: 45,
  notes: null,
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  reviewId: 'r1',
  appointmentId: 'a1',
  clientId: 'c1',
  clientName: 'Maria Rusu',
  masterId: 'm1',
  salonId: 's1',
  masterRating: 5,
  salonRating: 4,
  comment: 'Дуже добре',
  createdAt: '2026-09-01T10:00:00.000Z',
  hiddenAt: null,
  hiddenReason: null,
  ...overrides,
});

const rowNames = (page: Page) => page.getByTestId('client-name');

/** Picks an option of a PrimeNG select and waits for its overlay to leave. */
async function pick(page: Page, selectTestId: string, option: string): Promise<void> {
  await page.getByTestId(selectTestId).click();
  await page.getByRole('option', { name: option }).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

test.describe('clients list', () => {
  test('shows every client except Deleted ones, newest first', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/clients': CLIENTS });

    await signIn(page, ADMIN, '/clients');

    await expect(page.getByTestId('section-title')).toHaveText('Клієнти');
    await expect(rowNames(page)).toHaveText(['Maria Rusu', 'Vasile Ciobanu', 'Ion Popa']);
    await expect(page.getByTestId('client-row').nth(1).getByTestId('client-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('clients-built-at')).toContainText('Оновлено о');
  });

  test('searches by name, email and phone, keeping the query in the address', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/clients': CLIENTS });
    await signIn(page, ADMIN, '/clients');

    await page.getByTestId('clients-search').fill('maria');
    await expect(rowNames(page)).toHaveText(['Maria Rusu']);
    await expect(page).toHaveURL(/\/clients\?q=maria$/);

    await page.getByTestId('clients-search').fill('c3@bookme');
    await expect(rowNames(page)).toHaveText(['Vasile Ciobanu']);

    await page.getByTestId('clients-search').fill('69 555');
    await expect(rowNames(page)).toHaveText(['Ion Popa']);

    await page.getByTestId('clients-search').fill('');
    await expect(rowNames(page)).toHaveCount(3);
  });

  test('filters by state; Deleted clients appear only on request, clearly marked', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/clients': CLIENTS });
    await signIn(page, ADMIN, '/clients');

    await pick(page, 'clients-status-filter', 'Видалений');
    await expect(rowNames(page)).toHaveText(['Gone Client']);
    await expect(page.getByTestId('client-row')).toHaveAttribute('data-status', 'deleted');
    await expect(page).toHaveURL(/status=deleted/);

    await pick(page, 'clients-status-filter', 'Заблокований');
    await expect(rowNames(page)).toHaveText(['Vasile Ciobanu']);
  });

  test('ignores a ?city= it draws no control for, instead of emptying itself', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, { 'GET /admin/me': ME, 'GET /admin/clients': CLIENTS });

    // A person has no locality, so this table has no city column and no city filter — a stale or
    // hand-typed address must not leave a table nobody can un-filter from the screen.
    await signIn(page, ADMIN, '/clients?city=0100000');

    await expect(rowNames(page)).toHaveText(['Maria Rusu', 'Vasile Ciobanu', 'Ion Popa']);
    await expect(page.getByTestId('clients-city-filter')).toHaveCount(0);
    // …and the parameter leaves the address on the next navigation rather than lingering.
    await page.getByTestId('clients-search').fill('ion');
    await expect(page).toHaveURL(/\/clients\?q=ion$/);
  });

  test('opens a card from a row and restores the sort from a link', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients': CLIENTS,
      'GET /admin/clients/c1': apiOk(client()),
      'GET /admin/clients/c1/appointments': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/clients?sort=name&dir=asc');

    await expect(rowNames(page)).toHaveText(['Ion Popa', 'Maria Rusu', 'Vasile Ciobanu']);

    await page.getByTestId('client-name').filter({ hasText: 'Maria Rusu' }).click();
    await expect(page).toHaveURL(/\/clients\/c1\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Maria Rusu');
  });
});

test.describe('client card', () => {
  // Far from the platform's zone on purpose: every date of the card is the platform's, not here.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('shows the profile read-only, with no way to edit it', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
    });
    await signIn(page, ADMIN, '/clients/c1/profile');

    await expect(page.getByTestId('field-name')).toHaveText('Maria Rusu');
    await expect(page.getByTestId('field-email')).toHaveText('maria@bookme.md');
    await expect(page.getByTestId('field-phone')).toHaveText('+37360000001');
    // 22:30 UTC on the 10th is already the 11th in Chișinău; Los Angeles would say the 10th.
    await expect(page.getByTestId('field-createdAt')).toContainText('11');
    await expect(page.getByTestId('client-readonly')).toBeVisible();
    // The card that edits a Салон has this button; a person's card never does.
    await expect(page.getByTestId('profile-edit')).toHaveCount(0);
  });

  test('lists his Записи across venues, each on the clock it was booked under', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      'GET /admin/clients/c1/appointments': (url) =>
        apiOk({
          items: url.searchParams.get('status')
            ? [appointment({ appointmentId: 'a2', status: 'CANCELLED' })]
            : [
                appointment(),
                appointment({
                  appointmentId: 'a3',
                  salonId: null,
                  venueName: 'Ion Popa',
                  timezone: 'Europe/Bucharest',
                }),
              ],
          nextCursor: null,
        }),
    });
    await signIn(page, ADMIN, '/clients/c1/appointments');

    await expect(page.getByTestId('appointment-row')).toHaveCount(2);
    await expect(page.getByTestId('appointment-row-venue').first()).toHaveText('Beauty Lab');
    await expect(page.getByTestId('appointment-row-timezone').first()).toHaveText('Europe/Chisinau');
    await expect(page.getByTestId('appointment-row-timezone').nth(1)).toHaveText('Europe/Bucharest');
    // 07:00 UTC is 10:00 in Chișinău, and Los Angeles is ten hours behind it.
    await expect(page.getByTestId('appointment-row-when').first()).toContainText('10:00');

    await pick(page, 'appointments-filter-status', 'Скасовано');
    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    const asked = mock.bodies['GET /admin/clients/c1/appointments'];
    expect(asked).toHaveLength(2);
  });

  test('offers over each Запис what its own Місце allows — not what his own state does', async ({
    page,
    mockBackend,
  }) => {
    const own = {
      appointmentId: 'a2',
      masterId: 'm9',
      masterName: 'Ana Rusu',
      salonId: null,
      venueName: 'Ana Rusu',
    };
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // His card only reads, yet what may be done over his Записи is their venues' to say.
      'GET /admin/clients/c1': apiOk(
        client({ status: 'deleted', deletedAt: '2026-08-01T09:00:00.000Z' }),
      ),
      'GET /admin/clients/c1/appointments': apiOk({
        items: [appointment(), appointment(own)],
        nextCursor: null,
      }),
      'GET /admin/appointments/a1': apiOk(details(appointment(), { venueStatus: 'deleted' })),
      'GET /admin/appointments/a2': apiOk(details(appointment(own))),
    });
    await signIn(page, ADMIN, '/clients/c1/appointments');

    await page.getByTestId('appointment-row').first().click();
    await expectOnlyCancellation(page);

    await page.getByTestId('appointment-row').nth(1).click();
    await expectEveryAction(page);
  });

  test('lists the відгуки he wrote, hidden ones included, and can hide one', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      'GET /admin/clients/c1/reviews': apiOk({ items: [review()], nextCursor: null }),
      'POST /admin/reviews/r1/hide': apiOk(
        review({ hiddenAt: '2026-09-22T08:00:00.000Z', hiddenReason: 'Abusive' }),
      ),
    });
    await signIn(page, ADMIN, '/clients/c1/reviews');

    await expect(page.getByTestId('review-comment')).toHaveText('Дуже добре');
    // The feed of one person answers to none of the entity filters, so none are drawn.
    await expect(page.getByTestId('reviews-filter-rating')).toHaveCount(0);
    await expect(page.getByTestId('reviews-filter-state')).toHaveCount(0);
    await expect(page.getByTestId('reviews-filter-from')).toHaveCount(0);

    await page.getByTestId('review-hide').click();
    await page.getByTestId('reason-input').fill('Abusive');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('review-state')).toHaveText('Прихований');
    expect(mock.bodies['POST /admin/reviews/r1/hide']).toEqual([{ reason: 'Abusive' }]);
  });

  test('blocks with a reason and lifts it again, without offering a mass cancellation', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      'POST /admin/clients/c1/block': apiOk(client({ status: 'blocked', ...BLOCKED })),
      'POST /admin/clients/c1/unblock': apiOk(client()),
    });
    await signIn(page, ADMIN, '/clients/c1/profile');

    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Maria Rusu');
    // Блокування of a Клієнт cancels nothing and never offers to: those visits belong to the
    // businesses that took them.
    await expect(page.getByTestId('block-upcoming-cancel')).toHaveCount(0);
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await page.getByTestId('reason-input').fill('Repeated no-shows');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    const banner = page.getByTestId('card-blocked-banner');
    await expect(banner).toContainText('Repeated no-shows');
    // 08:00 UTC is 11:00 in Chișinău, and the browser is nine hours behind it.
    await expect(banner).toContainText('11:00');
    await expect(page.getByTestId('field-blockedReason')).toHaveText('Repeated no-shows');
    expect(mock.bodies['POST /admin/clients/c1/block']).toEqual([{ reason: 'Repeated no-shows' }]);

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Client explained the absences');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    expect(mock.bodies['POST /admin/clients/c1/unblock']).toEqual([
      { reason: 'Client explained the absences' },
    ]);
  });

  test('keeps the dialog and the typed reason when the backend refuses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      'POST /admin/clients/c1/block': apiError(409, 'PROFILE_ALREADY_BLOCKED'),
    });
    await signIn(page, ADMIN, '/clients/c1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Repeated no-shows');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Repeated no-shows');
    await expect(page.getByText('Профіль уже заблоковано. Оновіть сторінку.')).toBeVisible();
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
  });

  test('is not offered on a Видалений Клієнт — every write action refuses there', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(
        client({ status: 'deleted', deletedAt: '2026-08-01T09:00:00.000Z' }),
      ),
    });
    await signIn(page, ADMIN, '/clients/c1/profile');

    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('block-open')).toHaveCount(0);
  });

  test('shows «Історія» of the Блокування on the platform clock', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client({ status: 'blocked', ...BLOCKED })),
      'GET /admin/audit': (url) =>
        url.searchParams.get('target') === 'client:c1'
          ? apiOk({
              items: [
                {
                  auditId: 'au1',
                  adminId: 'e2e-user-sub',
                  adminEmail: ADMIN.email,
                  targetType: 'client',
                  targetId: 'c1',
                  salonId: null,
                  action: 'client.block',
                  createdAt: '2026-09-22T08:00:00.000Z',
                  changes: [
                    { field: 'blockedAt', before: null, after: '2026-09-22T08:00:00.000Z' },
                    { field: 'blockedReason', before: null, after: 'Repeated no-shows' },
                  ],
                  reason: 'Repeated no-shows',
                  affected: [],
                },
              ],
              nextCursor: null,
            })
          : apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/clients/c1/history');

    const entry = page.getByTestId('history-entry');
    await expect(entry).toHaveText(/Блокування Клієнта/);
    await expect(entry).toContainText('Repeated no-shows');
    // 08:00 UTC is 11:00 in Chișinău, and the browser is nine hours behind it.
    await expect(entry).toContainText('11:00');
  });

  test('says so when the client is not there', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/ghost': apiError(404, 'NOT_FOUND'),
    });
    await signIn(page, ADMIN, '/clients/ghost/profile');

    await expect(page.getByTestId('card-not-found')).toBeVisible();
  });
});
