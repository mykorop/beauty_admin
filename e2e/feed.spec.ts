import { apiError, apiOk, holdResponse, type MockResponse } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * Every стрічка of the panel — «Історія» of a card, «Інвайти» of a Салон, the Журнал дій, Відгуки
 * and Записи of a Клієнт — is read the same way: a page, then «Ще» for the next one. What is read
 * stays read; a refused page is a toast and «Ще» again; a press while a page is on its way asks for
 * nothing more; new filters start the list over and a page of the old list never lands in the new.
 *
 * Each case sits on the feed where it was once broken, or where it is easiest to see.
 */

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const AUDIT = 'GET /admin/audit';
const INVITES = 'GET /admin/salons/s1/invites';
const REFUSED = apiError(500, 'INTERNAL_SERVER_ERROR');

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

const auditEntry = (overrides: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: ADMIN.email,
  targetType: 'salon',
  targetId: 's1',
  salonId: 's1',
  action: 'salon.profile.update',
  createdAt: '2026-09-21T10:00:00.000Z',
  changes: [{ field: 'phone', before: '+37360000001', after: '+37360000002' }],
  reason: 'Owner asked by phone',
  affected: [],
  ...overrides,
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

const pageOf = (items: unknown[], nextCursor: string | null = null): MockResponse =>
  apiOk({ items, nextCursor });

test.describe('«Ще» after a refusal', () => {
  test('a Салон’s «Історія» keeps what it read and brings the next page on the next press', async ({
    page,
    mockBackend,
  }) => {
    const cursors: (string | null)[] = [];
    let olderReads = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [AUDIT]: (url) => {
        const cursor = url.searchParams.get('cursor');
        cursors.push(cursor);
        if (cursor === null) {
          return pageOf([auditEntry()], 'next-1');
        }
        return olderReads++ === 0 ? REFUSED : pageOf([auditEntry({ auditId: 'a2' })]);
      },
    });
    await signIn(page, ADMIN, '/salons/s1/history');
    const entries = page.getByTestId('history-entry');
    await expect(entries).toHaveCount(1);

    await page.getByTestId('history-more').click();

    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');
    await expect(entries).toHaveCount(1);
    await expect(page.getByTestId('history-failed')).toHaveCount(0);

    await page.getByTestId('history-more').click();

    await expect(entries).toHaveCount(2);
    await expect(page.getByTestId('history-more')).toHaveCount(0);
    expect(cursors).toEqual([null, 'next-1', 'next-1']);
  });

  test('a Салон’s «Інвайти» keep what they read and bring the next page on the next press', async ({
    page,
    mockBackend,
  }) => {
    const cursors: (string | null)[] = [];
    let olderReads = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [INVITES]: (url) => {
        const cursor = url.searchParams.get('cursor');
        cursors.push(cursor);
        if (cursor === null) {
          return pageOf([invite()], 'next-1');
        }
        return olderReads++ === 0
          ? REFUSED
          : pageOf([invite({ inviteId: 'i2', email: 'older@bookme.md' })]);
      },
    });
    await signIn(page, ADMIN, '/salons/s1/invites');
    const rows = page.getByTestId('invite-row');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('invites-more').click();

    await expect(page.getByTestId('toast')).toContainText('Помилка на сервері. Спробуйте пізніше.');
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId('invites-failed')).toHaveCount(0);

    await page.getByTestId('invites-more').click();

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText('older@bookme.md');
    await expect(page.getByTestId('invites-more')).toHaveCount(0);
    expect(cursors).toEqual([null, 'next-1', 'next-1']);
  });
});

test.describe('«Ще» while a page is on its way', () => {
  test('a second press asks for nothing more, and the page lands once', async ({
    page,
    mockBackend,
  }) => {
    const cursors: (string | null)[] = [];
    const older = holdResponse(pageOf([auditEntry({ auditId: 'a2' })]));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salon()),
      [AUDIT]: (url) => {
        const cursor = url.searchParams.get('cursor');
        cursors.push(cursor);
        return cursor === null ? pageOf([auditEntry()], 'next-1') : older.respond();
      },
    });
    await signIn(page, ADMIN, '/salons/s1/history');
    await expect(page.getByTestId('history-entry')).toHaveCount(1);

    await page.getByTestId('history-more').click();
    await older.requested;
    // Pressed through the busy look, as a second tap lands before the button has redrawn.
    await page.getByTestId('history-more').dispatchEvent('click');
    await older.release();

    await expect(page.getByTestId('history-entry')).toHaveCount(2);
    await expect(page.getByTestId('history-more')).toHaveCount(0);
    expect(cursors).toEqual([null, 'next-1']);
  });
});

test.describe('new filters', () => {
  test('a page of the Журнал дій asked under the old filters never lands under the new ones', async ({
    page,
    mockBackend,
  }) => {
    const late = holdResponse(pageOf([auditEntry({ auditId: 'late', targetId: 's9' })]));
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      [AUDIT]: (url) => {
        const filtered = url.searchParams.has('from');
        const cursor = url.searchParams.get('cursor');
        if (!filtered) {
          return cursor === null ? pageOf([auditEntry()], 'next-1') : late.respond();
        }
        return cursor === null
          ? pageOf([auditEntry({ auditId: 'f1', targetId: 's2' })], 'next-f')
          : pageOf([auditEntry({ auditId: 'f2', targetId: 's3' })]);
      },
    });
    await signIn(page, ADMIN, '/audit-log');
    const rows = page.getByTestId('audit-row');
    await expect(rows).toHaveCount(1);

    await page.getByTestId('audit-more').click();
    await late.requested;
    await page.getByTestId('audit-filter-from').fill('2026-09-01');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('s2');

    await late.release();
    // The new list read further: by the time its page is drawn, the late one has had its chance.
    await page.getByTestId('audit-more').click();

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('s2');
    await expect(rows.nth(1)).toContainText('s3');
    await expect(page.getByTestId('audit-table')).not.toContainText('s9');
    await expect(page.getByTestId('audit-more')).toHaveCount(0);
  });
});
