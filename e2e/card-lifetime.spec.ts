import type { Page } from '@playwright/test';
import { apiError, apiOk, holdResponse } from './fixtures/api-mock';
import { ADMIN, expect, goBackTo, signIn, test } from './fixtures/app.fixture';

/**
 * A profile card belongs to one opening of one profile. The router reuses the card for the next
 * profile — and for the same profile opened again — so an answer that lands late must find the
 * opening that asked for it, or nothing at all: never the profile shown now, its dialogs, its
 * pending state or its counts. Whatever the backend already did stays done; a later read shows it.
 *
 * The Салон card carries the whole matrix. Each other card proves its own wiring with a case or
 * two, and with what only it has: the Майстер салону's pair of ids, and the way from a Незалежний
 * майстер's address into the Ростер.
 *
 * Every late answer is held by the mock and let go at a chosen moment. Where a spec has to show
 * that a late answer changed nothing, the card makes a request of its own after it and waits for
 * that one to be drawn: by then the late answer has had its chance.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SEEN_UPDATED_AT = '2026-05-02T11:30:00.000Z';
const BLOCKED = {
  status: 'blocked',
  blockedAt: '2026-09-22T08:00:00.000Z',
  blockedReason: 'Fraud reports',
};
const NO_HISTORY = apiOk({ items: [], nextCursor: null });

const salon = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: 'Hair and nails',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
  locationLatitude: '47.0245',
  locationLongitude: '28.8323',
  phone: '+37360000001',
  email: 'ana@beautylab.md',
  timezone: 'Europe/Chisinau',
  rating: 4.8,
  reviewCount: 12,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: '#aa3366',
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

const NAIL_STUDIO = {
  salonId: 's2',
  name: 'Nail Studio',
  ownerName: 'Olga Rusu',
  description: 'Nails only',
};

const salonMaster = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
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
  joinedAt: '2026-02-01T09:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

const OLGA = {
  masterId: 'm2',
  masterName: 'Olga Rusu',
  email: 'olga@bookme.md',
  commissionPercent: 30,
};

const master = (overrides: Record<string, unknown> = {}) => ({
  masterId: 'm1',
  name: 'Ion Popa',
  description: 'Barber since 2019',
  addressStreet: 'Strada Mihai',
  addressHouseNumber: '4',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
  locationLatitude: null,
  locationLongitude: null,
  phone: '+37360000002',
  email: 'ion@bookme.md',
  specialization: 'barber',
  timezone: 'Europe/Chisinau',
  rating: 4.6,
  reviewCount: 7,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  salon: null,
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

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
  updatedAt: SEEN_UPDATED_AT,
  ...overrides,
});

const tab = (page: Page, path: string) =>
  page.locator(`a[data-testid="card-tab"][href$="/${path}"]`);

/** A row of a Салон's «Історія»; the specs tell rows apart by their reason. */
const historyEntry = (overrides: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: ADMIN.email,
  targetType: 'salon',
  targetId: 's1',
  salonId: 's1',
  action: 'salon.profile.update',
  createdAt: '2026-09-21T10:00:00.000Z',
  changes: [],
  reason: 'Beauty Lab edit',
  affected: [],
  ...overrides,
});

test.describe('картка Салону', () => {
  test('a Блокування answered after the card moved on leaves the next Салон, its dialog and its count alone', async ({
    page,
    mockBackend,
  }) => {
    const lateBlock = holdResponse(apiOk(salon(BLOCKED)));
    const nextCount = holdResponse(apiOk({ count: 2 }));
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 3 }),
      'GET /admin/salons/s2/appointments/upcoming-count': nextCount.respond,
      'POST /admin/salons/s1/block': lateBlock.respond,
      'POST /admin/salons/s2/block': apiOk(
        salon({ ...NAIL_STUDIO, ...BLOCKED, blockedReason: 'Spam' }),
      ),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('block-upcoming')).toContainText('3');
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();
    await lateBlock.requested;

    await goBackTo(page, '/salons/s2/profile');

    // A new opening: nothing of the last one's dialog, reason, pending state or count.
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(page.getByTestId('field-name')).toHaveText('Nail Studio');
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-input')).toHaveValue('');
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await page.getByTestId('reason-input').fill('Spam');
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();

    await lateBlock.release();
    await nextCount.release();

    // This Салон's own count came after the late answer, into the dialog that answer left open.
    await expect(page.getByTestId('block-upcoming')).toContainText('2');
    await expect(page.getByTestId('reason-input')).toHaveValue('Spam');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);

    // And the card's own Блокування is still the card's to finish: header and tabs follow it.
    await page.getByTestId('reason-confirm').click();
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('card-status')).toHaveText('Заблокований');
    await expect(page.getByTestId('card-blocked-banner')).toContainText('Spam');
    await expect(page.getByTestId('card-upcoming-count')).toContainText('2');
    await expect(page.getByTestId('field-name')).toHaveText('Nail Studio');
    expect(mock.bodies['POST /admin/salons/s2/block']).toEqual([{ reason: 'Spam' }]);
  });

  test('a profile edit answered after the card moved on does not become the next Салон', async ({
    page,
    mockBackend,
  }) => {
    const lateSave = holdResponse(
      apiOk(salon({ name: 'Beauty Lab 2', updatedAt: '2026-09-23T10:00:00.000Z' })),
    );
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'PATCH /admin/salons/s1/profile': lateSave.respond,
      'PATCH /admin/salons/s2/profile': apiOk(
        salon({
          ...NAIL_STUDIO,
          description: 'Nails and lashes',
          updatedAt: '2026-09-23T10:05:00.000Z',
        }),
      ),
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('profile-edit').click();
    await page.getByTestId('edit-name').fill('Beauty Lab 2');
    await page.getByTestId('edit-save').click();
    await lateSave.requested;

    await goBackTo(page, '/salons/s2/profile');

    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    // The form was the last Салон's; this one opens reading.
    await expect(page.getByTestId('profile-form')).toHaveCount(0);
    await page.getByTestId('profile-edit').click();
    await expect(page.getByTestId('edit-name')).toHaveValue('Nail Studio');
    await page.getByTestId('edit-description').fill('Nails and lashes');

    await lateSave.release();
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('profile-form')).toHaveCount(0);
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(page.getByTestId('field-name')).toHaveText('Nail Studio');
    await expect(page.getByTestId('field-description')).toHaveText('Nails and lashes');
    expect(mock.bodies['PATCH /admin/salons/s2/profile']).toEqual([
      { updatedAt: SEEN_UPDATED_AT, description: 'Nails and lashes' },
    ]);
  });

  test('an answer from an earlier opening of the same Салон does not overwrite the later opening', async ({
    page,
    mockBackend,
  }) => {
    const firstOpeningBlock = holdResponse(apiOk(salon(BLOCKED)));
    const secondOpeningCount = holdResponse(apiOk({ count: 1 }));
    let reads = 0;
    let counts = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      // The second opening reads the Салон as the Власник салону has just described it.
      'GET /admin/salons/s1': () =>
        apiOk(reads++ === 0 ? salon() : salon({ description: 'Hair, nails and lashes' })),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/salons/s1/appointments/upcoming-count': () =>
        counts++ === 0 ? apiOk({ count: 3 }) : secondOpeningCount.respond(),
      'GET /admin/salons/s2/appointments/upcoming-count': apiOk({ count: 0 }),
      'POST /admin/salons/s1/block': firstOpeningBlock.respond,
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();
    await firstOpeningBlock.requested;

    await goBackTo(page, '/salons/s2/profile');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await goBackTo(page, '/salons/s1/profile');

    await expect(page.getByTestId('field-description')).toHaveText('Hair, nails and lashes');
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await page.getByTestId('block-open').click();
    await expect(page.getByTestId('reason-input')).toHaveValue('');

    await firstOpeningBlock.release();
    await secondOpeningCount.release();

    await expect(page.getByTestId('block-upcoming')).toContainText('1');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await expect(page.getByTestId('field-description')).toHaveText('Hair, nails and lashes');
  });

  test('a refusal answered after the card moved on neither ends nor closes the next Салон’s own Блокування', async ({
    page,
    mockBackend,
  }) => {
    const lateRefusal = holdResponse(apiError(409, 'PROFILE_ALREADY_BLOCKED'));
    const nextCount = holdResponse(apiOk({ count: 2 }));
    const nextBlock = holdResponse(
      apiOk(salon({ ...NAIL_STUDIO, ...BLOCKED, blockedReason: 'Spam' })),
    );
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 0 }),
      'GET /admin/salons/s2/appointments/upcoming-count': nextCount.respond,
      'POST /admin/salons/s1/block': lateRefusal.respond,
      'POST /admin/salons/s2/block': nextBlock.respond,
    });
    await signIn(page, ADMIN, '/salons/s1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Fraud reports');
    await page.getByTestId('reason-confirm').click();
    await lateRefusal.requested;

    await goBackTo(page, '/salons/s2/profile');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Spam');
    await page.getByTestId('reason-confirm').click();
    await nextBlock.requested;
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await lateRefusal.release();
    await nextCount.release();

    // The count came after the refusal; this card's Блокування is still under way, reason intact.
    await expect(page.getByTestId('block-upcoming')).toContainText('2');
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await expect(page.getByTestId('reason-cancel')).toBeDisabled();
    await expect(page.getByTestId('reason-input')).toHaveValue('Spam');

    await nextBlock.release();
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('card-blocked-banner')).toContainText('Spam');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
  });

  test('a page of «Історія» answered after the card moved on stays out of the next Салон’s', async ({
    page,
    mockBackend,
  }) => {
    const latePage = holdResponse(
      apiOk({
        items: [historyEntry({ auditId: 'a2', reason: 'Older Beauty Lab edit' })],
        nextCursor: null,
      }),
    );
    const nailStudioEntry = (overrides: Record<string, unknown>) =>
      historyEntry({ targetId: 's2', salonId: 's2', reason: 'Nail Studio edit', ...overrides });
    const cursors: (string | null)[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/audit': (url) => {
        const cursor = url.searchParams.get('cursor');
        if (url.searchParams.get('target') === 'salon:s1') {
          return cursor
            ? latePage.respond()
            : apiOk({ items: [historyEntry()], nextCursor: 'next-s1' });
        }
        cursors.push(cursor);
        return cursor
          ? apiOk({
              items: [nailStudioEntry({ auditId: 'b2', reason: 'Older Nail Studio edit' })],
              nextCursor: null,
            })
          : apiOk({ items: [nailStudioEntry({ auditId: 'b1' })], nextCursor: 'next-s2' });
      },
    });
    await signIn(page, ADMIN, '/salons/s1/history');
    const entries = page.getByTestId('history-entry');
    await expect(entries).toHaveCount(1);

    await page.getByTestId('history-more').click();
    await latePage.requested;

    await goBackTo(page, '/salons/s2/history');
    await expect(page.getByTestId('card-title')).toHaveText('Nail Studio');
    await expect(entries).toHaveCount(1);
    await expect(entries.nth(0)).toContainText('Nail Studio edit');

    await latePage.release();
    // This Салон's own older page: by the time it is drawn, the late one has had its chance.
    await page.getByTestId('history-more').click();

    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText('Nail Studio edit');
    await expect(entries.nth(1)).toContainText('Older Nail Studio edit');
    await expect(page.getByTestId('history-more')).toHaveCount(0);
    expect(cursors).toEqual([null, 'next-s2']);
  });
});

test.describe('картка Майстра салону', () => {
  test('an edit answered after the card moved on to another Майстер stays with the one it was about', async ({
    page,
    mockBackend,
  }) => {
    const lateSave = holdResponse(
      apiOk(salonMaster({ commissionPercent: 50, updatedAt: '2026-09-23T10:00:00.000Z' })),
    );
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
      'GET /admin/salons/s1/masters/m2': apiOk(salonMaster(OLGA)),
      'PATCH /admin/salons/s1/masters/m1': lateSave.respond,
      'PATCH /admin/salons/s1/masters/m2': apiOk(
        salonMaster({ ...OLGA, commissionPercent: 35, updatedAt: '2026-09-23T10:05:00.000Z' }),
      ),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await page.getByTestId('master-edit').click();
    await page.getByTestId('edit-commissionPercent').fill('50');
    await page.getByTestId('edit-save').click();
    await lateSave.requested;

    await goBackTo(page, '/salons/s1/masters/m2/profile');

    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
    await expect(page.getByTestId('master-form')).toHaveCount(0);
    await expect(page.getByTestId('field-commission')).toHaveText('30%');
    await page.getByTestId('master-edit').click();
    await expect(page.getByTestId('edit-commissionPercent')).toHaveValue('30');
    await page.getByTestId('edit-commissionPercent').fill('35');

    await lateSave.release();
    await page.getByTestId('edit-save').click();

    await expect(page.getByTestId('master-form')).toHaveCount(0);
    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
    await expect(page.getByTestId('field-commission')).toHaveText('35%');
    expect(mock.bodies['PATCH /admin/salons/s1/masters/m2']).toEqual([
      { updatedAt: null, commissionPercent: 35 },
    ]);
  });

  test('a removal from the Ростер answered after the card moved to another Салон leaves that link alone', async ({
    page,
    mockBackend,
  }) => {
    const lateRemoval = holdResponse(apiOk({ removed: true, masterId: 'm1', status: 'INACTIVE' }));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      'GET /admin/salons/s2': apiOk(salon(NAIL_STUDIO)),
      'GET /admin/salons/s1/masters/m1': apiOk(salonMaster()),
      'GET /admin/salons/s2/masters/m1': apiOk(salonMaster({ commissionPercent: 25 })),
      'DELETE /admin/salons/s1/masters/m1': lateRemoval.respond,
      'GET /admin/reviews': apiOk({ items: [], nextCursor: null }),
      // The Ростер the spec ends on reads itself as it opens.
      'GET /admin/salons/s2/masters': apiOk({ items: [] }),
    });
    await signIn(page, ADMIN, '/salons/s1/masters/m1/profile');

    await page.getByTestId('master-remove').click();
    await page.getByTestId('reason-input').fill('Salon closed');
    await page.getByTestId('reason-confirm').click();
    await lateRemoval.requested;

    // The same Майстер, inside another Салон: another card.
    await goBackTo(page, '/salons/s2/masters/m1/profile');

    await expect(page.getByTestId('card-context')).toContainText('Nail Studio');
    await expect(page.getByTestId('field-commission')).toHaveText('25%');
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);

    await lateRemoval.release();
    await tab(page, 'reviews').click();
    await expect(page.getByTestId('reviews-empty')).toBeVisible();
    await tab(page, 'profile').click();

    await expect(page.getByTestId('card-context')).toContainText('Nail Studio');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('field-commission')).toHaveText('25%');
    await expect(page.getByTestId('master-remove')).toBeVisible();
    // Its Ростер is the Салон it is shown in.
    await page.getByTestId('card-back').click();
    await expect(page).toHaveURL(/\/salons\/s2\/roster$/);
  });
});

test.describe('картка Незалежного майстра', () => {
  test('a stale read of a Незалежний майстер now on a Ростер does not send the next card there', async ({
    page,
    mockBackend,
  }) => {
    const staleRead = holdResponse(
      apiOk(
        master({
          salon: {
            salonId: 's1',
            name: 'Beauty Lab',
            status: 'active',
            current: true,
            joinedAt: '2026-02-01T09:00:00.000Z',
            leftAt: null,
          },
        }),
      ),
    );
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': staleRead.respond,
      'GET /admin/masters/m2': apiOk(master({ masterId: 'm2', name: 'Olga Rusu' })),
      'GET /admin/audit': NO_HISTORY,
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');
    await staleRead.requested;

    await goBackTo(page, '/independent-masters/m2/profile');
    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');

    await staleRead.release();
    await tab(page, 'history').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();

    await expect(page).toHaveURL(/\/independent-masters\/m2\/history$/);
    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
  });

  test('a reload after an edit conflict answered after the card moved on does not become the next Майстер', async ({
    page,
    mockBackend,
  }) => {
    const lateReload = holdResponse(
      apiOk(master({ name: 'Ion Popa-Rusu', updatedAt: '2026-09-23T09:00:00.000Z' })),
    );
    let reads = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/masters/m1': () => (reads++ === 0 ? apiOk(master()) : lateReload.respond()),
      'PATCH /admin/masters/m1': apiError(409, 'EDIT_CONFLICT'),
      'GET /admin/masters/m2': apiOk(master({ masterId: 'm2', name: 'Olga Rusu' })),
      'GET /admin/audit': NO_HISTORY,
    });
    await signIn(page, ADMIN, '/independent-masters/m1/profile');

    await page.getByTestId('profile-edit').click();
    await page.getByTestId('edit-description').fill('Barber and stylist');
    await page.getByTestId('edit-save').click();
    await expect(page.getByTestId('edit-conflict')).toBeVisible();
    await page.getByTestId('edit-reload').click();
    await lateReload.requested;

    await goBackTo(page, '/independent-masters/m2/profile');
    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
    await expect(page.getByTestId('profile-form')).toHaveCount(0);

    await lateReload.release();
    await tab(page, 'history').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();

    await expect(page.getByTestId('card-title')).toHaveText('Olga Rusu');
    await tab(page, 'profile').click();
    await expect(page.getByTestId('field-name')).toHaveText('Olga Rusu');
  });
});

test.describe('картка Клієнта', () => {
  test('a Блокування answered after the card moved on leaves the next Клієнт and its dialog alone', async ({
    page,
    mockBackend,
  }) => {
    const lateBlock = holdResponse(apiOk(client(BLOCKED)));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/clients/c1': apiOk(client()),
      'GET /admin/clients/c2': apiOk(
        client({ clientId: 'c2', name: 'Ion Popa', email: 'ion@bookme.md' }),
      ),
      'POST /admin/clients/c1/block': lateBlock.respond,
      'GET /admin/audit': NO_HISTORY,
    });
    await signIn(page, ADMIN, '/clients/c1/profile');

    await page.getByTestId('block-open').click();
    await page.getByTestId('reason-input').fill('Repeated no-shows');
    await page.getByTestId('reason-confirm').click();
    await lateBlock.requested;

    await goBackTo(page, '/clients/c2/profile');

    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);

    await lateBlock.release();
    await tab(page, 'history').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    await tab(page, 'profile').click();

    await expect(page.getByTestId('card-title')).toHaveText('Ion Popa');
    await expect(page.getByTestId('field-email')).toHaveText('ion@bookme.md');
    await expect(page.getByTestId('card-status')).toHaveText('Активний');
    await expect(page.getByTestId('card-blocked-banner')).toHaveCount(0);
    await expect(page.getByTestId('field-blockedReason')).toHaveCount(0);
    await expect(page.getByTestId('block-open')).toHaveText('Заблокувати');
  });
});
