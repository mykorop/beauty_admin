import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const MASTER_PATH = '/admin/salons/s1/masters/m2';

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: '',
  addressStreet: '',
  addressHouseNumber: '',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: '',
  addressCountry: 'Moldova',
  locationLatitude: null,
  locationLongitude: null,
  phone: '',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 4.8,
  reviewCount: 12,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm2',
  isOwner: false,
  masterName: 'Ion Popa',
  masterAvatar: '',
  email: 'ion@bookme.md',
  specialization: 'barber',
  status: 'ACTIVE',
  commissionPercent: 40,
  bookingForwardDays: 14,
  rating: 4.6,
  reviewCount: 7,
  // 23:30 UTC is already 2 February in Chișinău.
  joinedAt: '2026-02-01T23:30:00.000Z',
  updatedAt: null,
  ...overrides,
});

const OWNER = master({
  masterId: 's1',
  isOwner: true,
  masterName: 'Ana Rusu',
  specialization: 'hair_specialist',
  commissionPercent: 0,
  reviewCount: 0,
  rating: 0,
});

const invite = (overrides: Record<string, unknown> = {}) => ({
  inviteId: 'i1',
  email: 'new.master@bookme.md',
  specialization: 'nail_specialist',
  commissionPercent: 35,
  status: 'SENT',
  respondedAt: null,
  deliveryFailed: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  expiresAt: '2026-09-08T10:00:00.000Z',
  ...overrides,
});

test.describe('salon roster', () => {
  test('lists the Ростер with link status, commission, rating and the Власник-майстер mark', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters': apiOk({
        items: [OWNER, master(), master({ masterId: 'm3', masterName: 'Old Hand', status: 'INACTIVE' })],
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/roster');

    const rows = page.getByTestId('roster-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).getByTestId('roster-owner')).toBeVisible();
    await expect(rows.nth(1).getByTestId('roster-owner')).toHaveCount(0);
    await expect(rows.nth(1)).toContainText('Ion Popa');
    await expect(rows.nth(1)).toContainText('Барбер');
    await expect(rows.nth(1)).toContainText('40%');
    await expect(rows.nth(1)).toContainText('4,6');
    await expect(rows.nth(1)).toContainText('2 лют. 2026');
    await expect(rows.nth(1).getByTestId('roster-status')).toHaveText('Активний');
    await expect(rows.nth(2).getByTestId('roster-status')).toHaveText('Співпрацю завершено');
    // Nobody rated the owner yet — a dash, not «0,0».
    await expect(rows.nth(0).getByTestId('roster-rating')).toHaveText('—');
  });

  test('offers no way to add a master past an Інвайт', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters': apiOk({ items: [] }),
    });
    await signIn(page, ADMIN, '/salons/s1/roster');

    await expect(page.getByTestId('roster-empty')).toBeVisible();
    await expect(page.getByTestId('roster-invite-only')).toBeVisible();
    await expect(page.getByRole('button', { name: /Додати|Запросити/ })).toHaveCount(0);
  });

  test('opens the Майстер салону from the Ростер, tabs under their own addresses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters': apiOk({ items: [OWNER, master()] }),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
    });
    await signIn(page, ADMIN, '/salons/s1/roster');

    await page.getByTestId('roster-name').filter({ hasText: 'Ion Popa' }).click();

    await expect(page).toHaveURL(/\/salons\/s1\/masters\/m2\/profile$/);
    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
    await expect(page.getByTestId('card-context')).toContainText('Beauty Lab');
    await expect(page.getByTestId('card-tab')).toHaveText([
      'Профіль',
      'Робочий графік',
      'Копії послуг',
      'Записи',
      'Відгуки',
    ]);
    await expect(page.getByTestId('field-specialization')).toHaveText('Барбер');
    await expect(page.getByTestId('field-commission')).toHaveText('40%');
    await expect(page.getByTestId('field-bookingHorizon')).toHaveText('14 дн.');

    await page.getByTestId('card-tab').filter({ hasText: 'Робочий графік' }).click();
    await expect(page).toHaveURL(/\/salons\/s1\/masters\/m2\/schedule$/);
    await expect(page.getByTestId('card-tab-stub')).toBeVisible();

    // Back to the Ростер, not to the list of salons.
    await page.getByTestId('card-back').click();
    await expect(page).toHaveURL(/\/salons\/s1\/roster$/);
  });

  test('says so when the master is not on this salon’s Ростер', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiError(404, 'NOT_FOUND'),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2');

    await expect(page.getByTestId('card-not-found')).toBeVisible();
  });
});

test.describe('salon master editing', () => {
  test('sends a PATCH with only the changed fields and the `updatedAt` it saw — `null` included', async ({
    page,
    mockBackend,
  }) => {
    const saved = master({ commissionPercent: 50, updatedAt: '2026-09-21T10:00:00.000Z' });
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
      [`PATCH ${MASTER_PATH}`]: apiOk(saved),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-edit').click();
    await expect(page.getByTestId('edit-save')).toBeDisabled();

    await page.getByTestId('edit-commissionPercent').fill('50');
    // Touched and put back: not a change.
    await page.getByTestId('edit-bookingForwardDays').fill('21');
    await page.getByTestId('edit-bookingForwardDays').fill('14');
    await page.getByTestId('edit-reason').fill('Owner asked by phone');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-commission')).toHaveText('50%');
    expect(mock.bodies[`PATCH ${MASTER_PATH}`]).toEqual([
      { updatedAt: null, commissionPercent: 50, reason: 'Owner asked by phone' },
    ]);
  });

  test('changes the specialization from the platform’s own list', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiOk(master({ updatedAt: '2026-06-01T00:00:00.000Z' })),
      [`PATCH ${MASTER_PATH}`]: apiOk(
        master({ specialization: 'cosmetologist', updatedAt: '2026-09-21T10:00:00.000Z' }),
      ),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-edit').click();
    await page.getByTestId('edit-specialization').click();
    await page.getByRole('option', { name: 'Косметолог' }).click();
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('field-specialization')).toHaveText('Косметолог');
    expect(mock.bodies[`PATCH ${MASTER_PATH}`]).toEqual([
      { updatedAt: '2026-06-01T00:00:00.000Z', specialization: 'cosmetologist' },
    ]);
  });

  test('offers to reload when the Власник салону changed the link meanwhile', async ({ page, mockBackend }) => {
    let reads = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: () =>
        apiOk(reads++ === 0 ? master() : master({ commissionPercent: 45, updatedAt: '2026-09-21T09:00:00.000Z' })),
      [`PATCH ${MASTER_PATH}`]: apiError(409, 'EDIT_CONFLICT'),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-edit').click();
    await page.getByTestId('edit-commissionPercent').fill('50');
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();

    await expect(page.getByTestId('edit-conflict')).toHaveCount(0);
    await expect(page.getByTestId('edit-commissionPercent')).toHaveValue('45');
  });

  test('has no status control, and no editing at all in a Видалений salon', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await expect(page.getByTestId('field-status')).toHaveText('Активний');
    await expect(page.getByTestId('master-edit')).toHaveCount(0);
    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
  });
});

test.describe('removal from the Ростер', () => {
  test('asks for a reason first: no confirming without one, then a DELETE that carries it', async ({
    page,
    mockBackend,
  }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
      [`DELETE ${MASTER_PATH}`]: apiOk({ removed: true, masterId: 'm2', status: 'INACTIVE' }),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-remove').click();
    await expect(page.getByTestId('reason-dialog')).toContainText('Ion Popa');
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    // Blanks are not a reason.
    await page.getByTestId('reason-input').fill('   ');
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await page.getByTestId('reason-input').fill('  Salon closed, master asked to be released ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Співпрацю завершено');
    await expect(page.getByTestId('master-remove')).toHaveCount(0);
    expect(mock.bodies[`DELETE ${MASTER_PATH}`]).toEqual([
      { reason: 'Salon closed, master asked to be released' },
    ]);
  });

  test('cancelling sends nothing and forgets what was typed', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-remove').click();
    await page.getByTestId('reason-input').fill('Changed my mind');
    await page.getByTestId('reason-cancel').click();
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);

    await page.getByTestId('master-remove').click();
    await expect(page.getByTestId('reason-input')).toHaveValue('');
    expect(mock.bodies[`DELETE ${MASTER_PATH}`]).toBeUndefined();
  });

  test('stays available in a Видалений salon, where editing is not', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon({ status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' })),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
      [`DELETE ${MASTER_PATH}`]: apiOk({ removed: true, masterId: 'm2', status: 'INACTIVE' }),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await expect(page.getByTestId('master-edit')).toHaveCount(0);
    await page.getByTestId('master-remove').click();
    await page.getByTestId('reason-input').fill('Stranded in a deleted salon');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('card-status')).toHaveText('Співпрацю завершено');
  });

  test('keeps the dialog and the reason when the backend refuses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [`GET ${MASTER_PATH}`]: apiOk(master()),
      [`DELETE ${MASTER_PATH}`]: apiError(409, 'MASTER_HAS_ACTIVE_APPOINTMENTS'),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m2/profile');

    await page.getByTestId('master-remove').click();
    await page.getByTestId('reason-input').fill('Owner unreachable');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByText('У Майстра є активні Записи в цьому Салоні')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Owner unreachable');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
  });

  for (const [who, path, body] of [
    ['the Власник-майстер', '/admin/salons/s1/masters/s1', OWNER],
    ['an ended collaboration', MASTER_PATH, master({ status: 'INACTIVE' })],
  ] as const) {
    test(`has no button for ${who}`, async ({ page, mockBackend }) => {
      await mockBackend(ADMIN, {
        'GET /admin/me': ME,
        'GET /admin/salons/s1': apiOk(salon()),
        [`GET ${path}`]: apiOk(body),
      });
      await signIn(page, ADMIN, `${path.replace('/admin', '')}/profile`);

      await expect(page.getByTestId('master-edit')).toBeVisible();
      await expect(page.getByTestId('master-remove')).toHaveCount(0);
    });
  }
});

test.describe('salon invites', () => {
  test('shows status, email and expiry on the salon’s clock — read-only', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/invites': apiOk({
        items: [
          invite(),
          invite({
            inviteId: 'i2',
            email: 'gone@bookme.md',
            status: 'EXPIRED',
            deliveryFailed: true,
          }),
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/salons/s1/invites');

    const rows = page.getByTestId('invite-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('new.master@bookme.md');
    await expect(rows.nth(0).getByTestId('invite-status')).toHaveText('Очікує');
    await expect(rows.nth(0).getByTestId('invite-expiresAt')).toContainText('8 вер. 2026');
    await expect(rows.nth(1).getByTestId('invite-status')).toHaveText('Термін вичерпано');
    await expect(rows.nth(1).getByTestId('invite-delivery-failed')).toBeVisible();
    await expect(page.getByTestId('invites-more')).toHaveCount(0);
    // Read-only: nothing to send, resend or revoke.
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  });

  test('pages through older Інвайти by cursor', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/invites': (url) =>
        url.searchParams.get('cursor') === 'next-1'
          ? apiOk({
              items: [invite({ inviteId: 'i2', email: 'older@bookme.md' })],
              nextCursor: null,
            })
          : apiOk({ items: [invite()], nextCursor: 'next-1' }),
    });
    await signIn(page, ADMIN, '/salons/s1/invites');

    await page.getByTestId('invites-more').click();

    await expect(page.getByTestId('invite-row')).toHaveCount(2);
    await expect(page.getByTestId('invites-more')).toHaveCount(0);
  });

  test('says so when the salon has sent none', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/invites': apiOk({ items: [], nextCursor: null }),
    });
    await signIn(page, ADMIN, '/salons/s1/invites');

    await expect(page.getByTestId('invites-empty')).toBeVisible();
  });
});
