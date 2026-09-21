import type { Page } from '@playwright/test';
import { apiError, apiOk, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const SCHEDULE = 'GET /admin/salons/s1/masters/m2/schedule';
const PATTERN = 'PUT /admin/salons/s1/masters/m2/schedule-pattern';
const TIME_OFF = 'POST /admin/salons/s1/masters/m2/time-off';
const TAB = '/salons/s1/masters/m2/schedule';

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

const MASTER = {
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
  joinedAt: '2026-02-01T23:30:00.000Z',
  updatedAt: null,
};

const open = (dayOfWeek: number) => ({ dayOfWeek, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] });
const closed = (dayOfWeek: number) => ({ dayOfWeek, isOpen: false, slots: [] });
/** The Салон and the Майстер both work Mon–Fri 09–18. */
const WEEK = [closed(0), open(1), open(2), open(3), open(4), open(5), closed(6)];

const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Pattern = { anchorDate: string; cycleLength: number; workingOffsets: number[] };
type Group = Record<string, unknown> & { groupId: string };

/**
 * What the backend holds, so a read after a write shows the write. The calendar opens on the
 * current month, so dates are counted from the window it asks for: `from` is always a Monday, and
 * `day(7)` — the Monday of the grid's second week — is the venue's today.
 */
const backend = (initial: { pattern?: (day: (offset: number) => string) => Pattern; timeOff?: boolean } = {}) => {
  const state = { from: '', reads: 0, pattern: null as Pattern | null, timeOff: null as Group[] | null };
  const day = (offset: number) => addDays(state.from, offset);

  const schedule = (url: URL): MockResponse => {
    state.from = url.searchParams.get('from') ?? '';
    state.reads += 1;
    if (state.reads === 1) {
      state.pattern = initial.pattern?.(day) ?? null;
    }
    state.timeOff ??= initial.timeOff
      ? [
          {
            groupId: 'g1',
            type: 'DAY_OFF',
            fromDate: day(8),
            toDate: day(9),
            slots: [],
            reason: 'Conference',
            createdAt: '2026-09-01T08:00:00.000Z',
          },
          {
            groupId: 'g2',
            type: 'CUSTOM_HOURS',
            fromDate: day(10),
            toDate: day(10),
            slots: [{ start: '12:00', end: '15:00' }],
            createdAt: '2026-09-01T08:00:00.000Z',
          },
        ]
      : [];
    return apiOk({
      weeklyHours: WEEK,
      schedulePattern: state.pattern,
      timeOff: state.timeOff,
      appointments: [],
      todayDate: day(7),
      timezone: 'Europe/Chisinau',
    });
  };

  const routes = (extra: MockRoutes = {}, salonOverrides = {}): MockRoutes => ({
    'GET /admin/me': ME,
    'GET /admin/salons/s1': apiOk(salon(salonOverrides)),
    'GET /admin/salons/s1/masters/m2': apiOk(MASTER),
    'GET /admin/salons/s1/hours': apiOk({ days: WEEK }),
    [SCHEDULE]: schedule,
    ...extra,
  });

  return { state, day, routes };
};

/** The grid starts on a Monday; cell 7 is the Monday of its second week — today. */
const cell = (page: Page, index: number) => page.getByTestId('calendar-day').nth(index);
const rotationDay = (page: Page, index: number) => page.getByTestId('rotation-day').nth(index);
const row = (page: Page, index: number) => page.getByTestId('time-off-row').nth(index);

test.describe('salon master Ротація', () => {
  test('sets a Ротація counted from today, and the calendar follows it', async ({ page, mockBackend }) => {
    const { day, routes } = backend();
    const mock = await mockBackend(
      ADMIN,
      routes({
        [PATTERN]: (_url, body) => {
          const { patternType: _patternType, ...pattern } = (body as { pattern: Pattern & { patternType: string } })
            .pattern;
          return apiOk({ schedulePattern: pattern });
        },
      }),
    );
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('rotation-summary')).toContainText('Ротації немає');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'OPEN');
    await page.getByTestId('rotation-edit').click();

    // Opens on «2 через 2» from the venue's today.
    await expect(page.getByTestId('rotation-anchor')).toHaveValue(day(7));
    await expect(page.getByTestId('rotation-length')).toHaveValue('4');
    await expect(page.getByTestId('rotation-day')).toHaveCount(4);
    await expect(rotationDay(page, 1)).toBeChecked();
    await expect(rotationDay(page, 2)).not.toBeChecked();

    await page.getByTestId('rotation-length').fill('3');
    await expect(page.getByTestId('rotation-day')).toHaveCount(3);
    // A cycle that works every day is no Ротація: the domain refuses it, so the form does not send it.
    await rotationDay(page, 2).check();
    await expect(page.getByTestId('rotation-save')).toBeDisabled();
    await rotationDay(page, 2).uncheck();
    await page.getByTestId('rotation-reason').fill('Master asked by phone');
    await page.getByTestId('rotation-save').click();

    await expect(page.getByTestId('rotation-form')).toHaveCount(0);
    expect(mock.bodies[PATTERN]).toEqual([
      {
        pattern: { patternType: 'CYCLE', anchorDate: day(7), cycleLength: 3, workingOffsets: [0, 1] },
        reason: 'Master asked by phone',
      },
    ]);
    await expect(page.getByTestId('rotation-summary')).toContainText('Цикл 3 дн., робочі дні циклу: 1, 2');
    // Monday and Tuesday worked, Wednesday off by the cycle, Thursday worked again.
    await expect(cell(page, 8)).toHaveAttribute('data-status', 'OPEN');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'PATTERN_OFF');
    await expect(cell(page, 9).getByTestId('calendar-day-hours')).toHaveText('Вихідний за Ротацією');
    await expect(cell(page, 10)).toHaveAttribute('data-status', 'OPEN');
  });

  test('changes a stored Ротація and removes it with `pattern: null`', async ({ page, mockBackend }) => {
    const { routes } = backend({
      pattern: (day) => ({ anchorDate: day(7), cycleLength: 4, workingOffsets: [0, 1] }),
    });
    const mock = await mockBackend(ADMIN, routes({ [PATTERN]: apiOk({ schedulePattern: null }) }));
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('rotation-summary')).toContainText('Цикл 4 дн., робочі дні циклу: 1, 2');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'PATTERN_OFF');

    await page.getByTestId('rotation-edit').click();
    await expect(rotationDay(page, 0)).toBeChecked();
    await expect(rotationDay(page, 3)).not.toBeChecked();
    await page.getByTestId('rotation-reason').fill('Back to a plain week');
    await page.getByTestId('rotation-remove').click();

    await expect(page.getByTestId('rotation-form')).toHaveCount(0);
    expect(mock.bodies[PATTERN]).toEqual([{ pattern: null, reason: 'Back to a plain week' }]);
    await expect(page.getByTestId('rotation-summary')).toContainText('Ротації немає');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'OPEN');
  });
});

test.describe('salon master Відсутності', () => {
  test('lists them by period, with the type and the reason', async ({ page, mockBackend }) => {
    const { routes } = backend({ timeOff: true });
    await mockBackend(ADMIN, routes());
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('time-off-row')).toHaveCount(2);
    // Two dates, one row.
    await expect(row(page, 0).getByTestId('time-off-period')).toContainText('–');
    await expect(row(page, 0).getByTestId('time-off-type')).toHaveText('Вихідний');
    await expect(row(page, 0).getByTestId('time-off-row-reason')).toHaveText('Conference');
    await expect(row(page, 1).getByTestId('time-off-type')).toContainText('Особливі години');
    await expect(row(page, 1).getByTestId('time-off-type')).toContainText('12:00 – 15:00');
    await expect(row(page, 1).getByTestId('time-off-row-reason')).toHaveText('—');

    await page.getByTestId('language-switcher').click();
    await page.getByRole('option', { name: 'Română' }).click();
    await expect(row(page, 0).getByTestId('time-off-type')).toHaveText('Zi liberă');
  });

  test('files a Відсутність over a range of dates, and the list and the calendar follow', async ({
    page,
    mockBackend,
  }) => {
    const { state, day, routes } = backend();
    const mock = await mockBackend(
      ADMIN,
      routes({
        [TIME_OFF]: (_url, body) => {
          const { timeOff } = body as { timeOff: Record<string, unknown> };
          const group = { groupId: 'g9', slots: [], createdAt: '2026-09-22T08:00:00.000Z', ...timeOff };
          state.timeOff = [group];
          return { status: 201, body: apiOk(group).body };
        },
      }),
    );
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('time-off-empty')).toBeVisible();
    await page.getByTestId('time-off-add').click();
    await expect(page.getByTestId('time-off-save')).toBeDisabled();

    await page.getByTestId('time-off-type-BLOCKED').check();
    await page.getByTestId('time-off-from').fill(day(9));
    await page.getByTestId('time-off-to').fill(day(8));
    await expect(page.getByTestId('time-off-issue')).toHaveText('Початок періоду має бути не пізніше за кінець.');
    await expect(page.getByTestId('time-off-save')).toBeDisabled();
    await page.getByTestId('time-off-to').fill(day(10));
    await expect(page.getByTestId('time-off-issue')).toHaveCount(0);
    await page.getByTestId('time-off-reason').fill('Training');
    await page.getByTestId('time-off-audit-reason').fill('Owner asked by phone');
    await page.getByTestId('time-off-save').click();

    await expect(page.getByTestId('time-off-form')).toHaveCount(0);
    // The reason of the Відсутність travels with it; the top-level one is the Журнал's.
    expect(mock.bodies[TIME_OFF]).toEqual([
      {
        timeOff: { type: 'BLOCKED', fromDate: day(9), toDate: day(10), reason: 'Training' },
        reason: 'Owner asked by phone',
      },
    ]);
    await expect(page.getByTestId('time-off-row')).toHaveCount(1);
    await expect(row(page, 0).getByTestId('time-off-type')).toHaveText('Заблокований проміжок');
    await expect(row(page, 0).getByTestId('time-off-row-reason')).toHaveText('Training');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'BLOCKED');
    await expect(cell(page, 10)).toHaveAttribute('data-status', 'BLOCKED');
    await expect(cell(page, 11)).toHaveAttribute('data-status', 'OPEN');
  });

  test('shows the month a Відсутність was filed in when it is not the one on screen', async ({
    page,
    mockBackend,
  }) => {
    const { state, day, routes } = backend();
    await mockBackend(
      ADMIN,
      routes({
        [TIME_OFF]: (_url, body) => {
          const { timeOff } = body as { timeOff: Record<string, unknown> };
          const group = { groupId: 'g9', slots: [], createdAt: '', ...timeOff };
          state.timeOff = [group];
          return { status: 201, body: apiOk(group).body };
        },
      }),
    );
    await signIn(page, ADMIN, TAB);
    await expect(page.getByTestId('calendar-day').first()).toBeVisible();
    const shown = await page.getByTestId('calendar-month').textContent();
    const later = day(60);

    await page.getByTestId('time-off-add').click();
    await page.getByTestId('time-off-from').fill(later);
    await page.getByTestId('time-off-to').fill(later);
    await page.getByTestId('time-off-save').click();

    await expect(page.getByTestId('calendar-month')).not.toHaveText(shown ?? '');
    await expect(page.getByTestId('time-off-row')).toHaveCount(1);
    await expect(page.locator(`[data-date="${later}"]`)).toHaveAttribute('data-status', 'DAY_OFF');
  });

  test('names the Записи standing in the range and files over them only once confirmed', async ({
    page,
    mockBackend,
  }) => {
    const { day, routes } = backend();
    const mock = await mockBackend(
      ADMIN,
      routes({
        [TIME_OFF]: (_url, body) => {
          const { timeOff } = body as { timeOff: Record<string, unknown> };
          return timeOff['allowExistingAppointments']
            ? { status: 201, body: apiOk({ groupId: 'g9', slots: [], createdAt: '', ...timeOff }).body }
            : apiError(409, 'TIME_OFF_HAS_APPOINTMENTS', 'Booked appointments in range', {
                dates: [day(9)],
                appointmentCount: 2,
                appointments: [],
              });
        },
      }),
    );
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('time-off-add').click();
    await page.getByTestId('time-off-from').fill(day(8));
    await page.getByTestId('time-off-to').fill(day(9));
    await page.getByTestId('time-off-save').click();

    // Nothing is cancelled and nothing is filed: the form stays, and says what is in the way.
    await expect(page.getByTestId('time-off-conflict')).toContainText('активні Записи: 2');
    await expect(page.getByTestId('time-off-form')).toBeVisible();

    await page.getByTestId('time-off-confirm').click();

    await expect(page.getByTestId('time-off-form')).toHaveCount(0);
    const timeOff = { type: 'DAY_OFF', fromDate: day(8), toDate: day(9) };
    expect(mock.bodies[TIME_OFF]).toEqual([
      { timeOff },
      { timeOff: { ...timeOff, allowExistingAppointments: true } },
    ]);
  });

  test('words особливі години outside the Години роботи Салону, and keeps the form as typed', async ({
    page,
    mockBackend,
  }) => {
    const { day, routes } = backend();
    const mock = await mockBackend(
      ADMIN,
      routes({
        [TIME_OFF]: apiError(400, 'MASTER_HOURS_OUTSIDE_SALON_HOURS', 'Monday 08:00-12:00 is outside', {
          dayOfWeek: 1,
          outsideSlot: { start: '08:00', end: '12:00' },
          salonSlots: [{ start: '09:00', end: '18:00' }],
        }),
      }),
    );
    await signIn(page, ADMIN, TAB);

    await page.getByTestId('time-off-add').click();
    await page.getByTestId('time-off-type-CUSTOM_HOURS').check();
    await page.getByTestId('time-off-from').fill(day(14));
    await page.getByTestId('time-off-to').fill(day(14));
    await page.getByTestId('time-off-start').fill('12:00');
    await page.getByTestId('time-off-end').fill('08:00');
    await expect(page.getByTestId('time-off-issue')).toHaveText('Початок вікна має бути раніше за кінець.');
    await page.getByTestId('time-off-start').fill('08:00');
    await page.getByTestId('time-off-end').fill('12:00');
    await page.getByTestId('time-off-save').click();

    await expect(page.getByTestId('time-off-refusal')).toHaveText(
      'Понеділок: 08:00 – 12:00 виходить за Години роботи Салону (09:00 – 18:00).',
    );
    expect(mock.bodies[TIME_OFF]).toEqual([
      {
        timeOff: {
          type: 'CUSTOM_HOURS',
          fromDate: day(14),
          toDate: day(14),
          slots: [{ start: '08:00', end: '12:00' }],
        },
      },
    ]);
    await expect(page.getByTestId('time-off-start')).toHaveValue('08:00');
  });

  test('removes the whole group after a confirmation', async ({ page, mockBackend }) => {
    const { state, routes } = backend({ timeOff: true });
    const REMOVE = 'DELETE /admin/salons/s1/masters/m2/time-off/g1';
    const mock = await mockBackend(
      ADMIN,
      routes({
        [REMOVE]: () => {
          state.timeOff = (state.timeOff ?? []).filter((group) => group.groupId !== 'g1');
          return apiOk({ removed: true, groupId: 'g1' });
        },
      }),
    );
    await signIn(page, ADMIN, TAB);

    await expect(cell(page, 8)).toHaveAttribute('data-status', 'DAY_OFF');
    await row(page, 0).getByTestId('time-off-remove').click();
    // Asking is not removing.
    expect(mock.bodies[REMOVE]).toBeUndefined();
    await row(page, 0).getByTestId('time-off-remove-cancel').click();
    await row(page, 0).getByTestId('time-off-remove').click();
    await row(page, 0).getByTestId('time-off-remove-reason').fill('Filed by mistake');
    await row(page, 0).getByTestId('time-off-remove-confirm').click();

    await expect(page.getByTestId('time-off-row')).toHaveCount(1);
    expect(mock.bodies[REMOVE]).toEqual([{ reason: 'Filed by mistake' }]);
    await expect(row(page, 0).getByTestId('time-off-type')).toContainText('Особливі години');
    // Both dates of the group are worked again.
    await expect(cell(page, 8)).toHaveAttribute('data-status', 'OPEN');
    await expect(cell(page, 9)).toHaveAttribute('data-status', 'OPEN');
  });

  test('offers no writing inside a Видалений salon', async ({ page, mockBackend }) => {
    const { routes } = backend({ timeOff: true });
    await mockBackend(ADMIN, routes({}, { status: 'deleted', deletedAt: '2026-08-01T12:00:00.000Z' }));
    await signIn(page, ADMIN, TAB);

    await expect(page.getByTestId('time-off-row')).toHaveCount(2);
    await expect(page.getByTestId('rotation-edit')).toHaveCount(0);
    await expect(page.getByTestId('time-off-add')).toHaveCount(0);
    await expect(page.getByTestId('time-off-remove')).toHaveCount(0);
  });
});

test.describe('Журнал дій of a Робочий графік', () => {
  test('words a Ротація and a Відсутність as their tab does', async ({ page, mockBackend }) => {
    const entry = (auditId: string, action: string, changes: unknown[]) => ({
      auditId,
      adminId: 'e2e-user-sub',
      adminEmail: ADMIN.email,
      targetType: 'master',
      targetId: 'm2',
      salonId: 's1',
      action,
      createdAt: '2026-09-21T10:00:00.000Z',
      changes,
      reason: null,
      affected: [],
    });
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/audit': apiOk({
        items: [
          entry('a1', 'salon.master.schedule-pattern.update', [
            {
              field: 'schedulePattern',
              before: null,
              after: { anchorDate: '2026-10-01', cycleLength: 4, workingOffsets: [0, 1] },
            },
          ]),
          entry('a2', 'salon.master.time-off.remove', [
            {
              field: 'timeOff.0b0e7c4e-1111-4222-8333-444455556666',
              before: { type: 'DAY_OFF', fromDate: '2026-10-12', toDate: '2026-10-14', slots: [], reason: 'Conference' },
              after: null,
            },
          ]),
        ],
        nextCursor: null,
      }),
    });
    await signIn(page, ADMIN, '/audit-log');

    await expect(page.getByTestId('audit-row').nth(0)).toContainText('Зміна Ротації Майстра');
    await expect(page.getByTestId('audit-row').nth(1)).toContainText('Видалення Відсутності Майстра');

    await page.getByTestId('audit-row').nth(0).click();
    const rotation = page.getByTestId('audit-details').getByTestId('history-change');
    await expect(rotation).toContainText('Ротація');
    await expect(rotation).toContainText('Цикл 4 дн., робочі дні циклу: 1, 2');

    await page.getByTestId('audit-row').nth(0).click();
    await page.getByTestId('audit-row').nth(1).click();
    const timeOff = page.getByTestId('audit-details').getByTestId('history-change');
    await expect(timeOff).toContainText('Відсутність');
    await expect(timeOff).not.toContainText('0b0e7c4e');
    await expect(timeOff).toContainText('Вихідний');
    await expect(timeOff).toContainText('Conference');
  });
});
