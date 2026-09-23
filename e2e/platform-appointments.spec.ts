import { apiOk, type MockResponse, type MockRoutes } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

/**
 * «Записи» — the наскрізний список of the whole platform.
 *
 * What these specs are about: nobody named, the page is one day of the platform, gathered by the
 * backend off the request path and followed until it lands; somebody named — a Салон, a Майстер, a
 * Клієнт — it is a window read at once from that one's own partition. Either way the view lives in
 * the address, every hour is printed on its Запис's own clock rather than the browser's, and a
 * click opens the Запис with the actions over it.
 */

// Far from Chișinău on purpose: the page runs on the platform's calendar and each row's own clock.
test.use({ timezoneId: 'America/Los_Angeles' });

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const LIST = 'GET /admin/appointments';
const DAY_STATE = 'GET /admin/appointments/day';
const DAY_START = 'POST /admin/appointments/day';

/** The page polls every two seconds; a result is two polls away at most. */
const FOLLOW = { timeout: 10_000 };

const platformDay = (instant: number): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Chisinau',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));

const PLATFORM_TODAY = platformDay(Date.now());
const DAY_MS = 86_400_000;
const shiftDay = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** A day the specs can hold still: 09:00 in Chișinău is 06:00Z on it, and 23:00 the evening before in Los Angeles. */
const DAY = '2026-09-23';

/** Two days ahead, so the actions over a Запис are never decided by «у минулому». */
const AHEAD = shiftDay(PLATFORM_TODAY, 2);

const appointment = (overrides: Record<string, unknown> = {}) => ({
  appointmentId: 'a1',
  startTime: `${DAY}T06:00:00Z`,
  endTime: `${DAY}T06:45:00Z`,
  status: 'BOOKED',
  clientName: 'Maria Client',
  masterId: 'm2',
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

/** A Запис a Незалежний майстер took — the place is he. */
const independent = appointment({
  appointmentId: 'a2',
  startTime: `${DAY}T12:00:00Z`,
  endTime: `${DAY}T13:00:00Z`,
  status: 'CANCELLED',
  masterId: 'm9',
  masterName: 'Ana Rusu',
  salonId: null,
  venueName: 'Ana Rusu',
  serviceNames: ['Манікюр'],
  totalPrice: 400,
});

const run = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  status: 'running',
  startedAt: '2026-09-23T09:00:00.000Z',
  finishedAt: null,
  scannedItems: 0,
  estimatedItems: null,
  errorCode: null,
  ...overrides,
});

const gathered = (items: unknown[], overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  date: DAY,
  builtAt: '2026-09-23T09:00:00.000Z',
  timeZone: 'Europe/Chisinau',
  scannedItems: 5000,
  items,
  ...overrides,
});

const dayState = (state: { run: unknown; result: unknown }): MockResponse => apiOk(state);

const SALONS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  items: [
    {
      salonId: 's1',
      name: 'Beauty Lab',
      city: 'Chișinău',
      cityCode: '0100000',
      ownerName: 'Ana Rusu',
      email: 's1@bookme.md',
      phone: '+37360000000',
      rating: 4.5,
      reviewCount: 3,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const MASTERS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  items: [
    {
      masterId: 'm9',
      name: 'Ana Rusu',
      city: 'Chișinău',
      cityCode: '0100000',
      specialization: 'nail_specialist',
      email: 'm9@bookme.md',
      phone: '+37360000002',
      rating: 4.6,
      reviewCount: 7,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const CLIENTS = apiOk({
  builtAt: '2026-09-20T10:00:00.000Z',
  items: [
    {
      clientId: 'c1',
      name: 'Maria Client',
      email: 'maria@bookme.md',
      phone: '+37360000003',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const ROSTER = apiOk({
  items: [
    {
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
    },
  ],
});

/** What every view of the page loads: the three lists its pickers are filled from. */
const routes = (extra: MockRoutes = {}): MockRoutes => ({
  'GET /admin/me': ME,
  'GET /admin/salons': SALONS,
  'GET /admin/masters': MASTERS,
  'GET /admin/clients': CLIENTS,
  ...extra,
});

test.describe('Записи всієї платформи за день', () => {
  test('open on the platform’s today with nobody named, and say the day has not been gathered', async ({
    page,
    mockBackend,
  }) => {
    const asked: (string | null)[] = [];
    await mockBackend(
      ADMIN,
      routes({
        [DAY_STATE]: (url) => {
          asked.push(url.searchParams.get('date'));
          return dayState({ run: null, result: null });
        },
      }),
    );

    await signIn(page, ADMIN, '/appointments');

    await expect(page.getByTestId('section-title')).toHaveText('Записи');
    await expect(page.getByTestId('appointments-day-never')).toBeVisible();
    await expect(page.getByTestId('appointments-day-run')).toContainText('Зібрати Записи за день');
    await expect(page.getByTestId('appointment-row')).toHaveCount(0);
    // Chișinău's today — not the browser's, which may still be yesterday in Los Angeles.
    await expect(page).toHaveURL(new RegExp(`date=${PLATFORM_TODAY}`));
    expect(asked).toEqual([PLATFORM_TODAY]);
  });

  test('gather the day off the request path, follow it, and list what it found on each row’s own clock', async ({
    page,
    mockBackend,
  }) => {
    let started = false;
    let polls = 0;
    const mock = await mockBackend(
      ADMIN,
      routes({
        [DAY_STATE]: () => {
          if (!started) {
            return dayState({ run: null, result: null });
          }
          polls += 1;
          return polls === 1
            ? dayState({ run: run({ scannedItems: 1250, estimatedItems: 5000 }), result: null })
            : dayState({
                run: run({
                  status: 'succeeded',
                  finishedAt: '2026-09-23T09:01:00.000Z',
                  scannedItems: 5000,
                }),
                result: gathered([appointment(), independent]),
              });
        },
        [DAY_START]: () => {
          started = true;
          return { status: 202, ...apiOk(run()) };
        },
      }),
    );
    await signIn(page, ADMIN, `/appointments?date=${DAY}`);
    await expect(page.getByTestId('appointments-day-never')).toBeVisible();

    await page.getByTestId('appointments-day-run').click();

    // Followed: the share of the table read so far, while the backend reads it.
    await expect(page.getByTestId('appointments-day-progress')).toContainText(
      /Прочитано 1\s?250 з ≈ 5\s?000 рядків/,
      FOLLOW,
    );
    await expect(page.getByTestId('appointment-row')).toHaveCount(2, FOLLOW);
    expect(mock.bodies[DAY_START]).toEqual([{ date: DAY }]);

    const first = page.getByTestId('appointment-row').first();
    // 06:00Z is 09:00 in Chișinău — not 23:00 the evening before, which is Los Angeles.
    await expect(first.getByTestId('appointment-row-when')).toContainText('09:00');
    await expect(first.getByTestId('appointment-row-venue')).toHaveText('Beauty Lab');
    await expect(first.getByTestId('appointment-row-client')).toHaveText('Maria Client');
    await expect(first.getByTestId('appointment-row-master')).toHaveText('Ion Popa');
    const second = page.getByTestId('appointment-row').nth(1);
    await expect(second.getByTestId('appointment-row-venue')).toContainText('Ana Rusu');
    await expect(second.getByTestId('appointment-row-venue')).toContainText('Незалежний майстер');
    await expect(second.getByTestId('appointment-row-status')).toHaveText('Скасовано');
    await expect(page.getByTestId('appointments-day-built-at')).toBeVisible();
    await expect(page.getByTestId('appointments-day-run')).toContainText('Зібрати знову');
  });

  test('filter a gathered day by status in the browser, and keep the status in the address', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({
        [DAY_STATE]: dayState({
          run: run({ status: 'succeeded', finishedAt: '2026-09-23T09:01:00.000Z' }),
          result: gathered([appointment(), independent]),
        }),
      }),
    );
    await signIn(page, ADMIN, `/appointments?date=${DAY}`);
    await expect(page.getByTestId('appointment-row')).toHaveCount(2);

    await page.getByTestId('appointments-filter-status').click();
    await page.getByRole('option', { name: 'Скасовано' }).click();

    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    await expect(page.getByTestId('appointment-row-venue')).toContainText('Ana Rusu');
    await expect(page).toHaveURL(/status=CANCELLED/);
    await expect(page).toHaveURL(new RegExp(`date=${DAY}`));
  });

  test('keep an opened Запис open while the day is gathered again underneath it', async ({
    page,
    mockBackend,
  }) => {
    const booked = appointment({ startTime: `${AHEAD}T06:00:00Z`, endTime: `${AHEAD}T06:45:00Z` });
    let polls = 0;
    await mockBackend(
      ADMIN,
      routes({
        // The previous gathering stays on screen while a new one reads — poll after poll.
        [DAY_STATE]: () => {
          polls += 1;
          return dayState({
            run: run({ runId: 'run-2', scannedItems: polls * 100, estimatedItems: 5000 }),
            result: gathered([booked]),
          });
        },
        'GET /admin/appointments/a1': apiOk({
          ...booked,
          updatedAt: null,
          clientId: 'c1',
          clientPhone: '+37360000001',
          salonName: 'Beauty Lab',
          services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
          totalDurationMinutes: 45,
          notes: null,
        }),
      }),
    );
    await signIn(page, ADMIN, `/appointments?date=${DAY}`);

    await page.getByTestId('appointment-row').click();
    await expect(page.getByTestId('appointment-actions')).toBeVisible();

    // Two more polls land; the card the administrator is reading stays where it is.
    await expect.poll(() => polls, FOLLOW).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId('appointment-actions')).toBeVisible();
  });

  test('say a gathering failed, and keep the day’s previous list on screen', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(
      ADMIN,
      routes({
        [DAY_STATE]: dayState({
          run: run({
            status: 'failed',
            errorCode: 'TIMED_OUT',
            finishedAt: '2026-09-23T09:15:00.000Z',
          }),
          result: gathered([appointment()]),
        }),
      }),
    );

    await signIn(page, ADMIN, `/appointments?date=${DAY}`);

    await expect(page.getByTestId('appointments-day-failed')).toContainText('не встигло');
    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
  });
});

test.describe('Записи одного Салону, Майстра чи Клієнта', () => {
  test('narrow to a Салон and then its Майстер — read at once, over a window around today', async ({
    page,
    mockBackend,
  }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      routes({
        [DAY_STATE]: dayState({ run: null, result: null }),
        'GET /admin/salons/s1/masters': ROSTER,
        [LIST]: (url) => {
          asked.push(url.searchParams);
          return apiOk({ items: [appointment()] });
        },
      }),
    );
    await signIn(page, ADMIN, '/appointments');
    await expect(page.getByTestId('appointments-day-never')).toBeVisible();

    await page.getByTestId('appointments-scope-salon').click();
    await page.getByRole('option', { name: 'Beauty Lab' }).click();

    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    // No day to gather once somebody is named: the list is a read of that one's own partition.
    await expect(page.getByTestId('appointments-day')).toHaveCount(0);
    await expect(page).toHaveURL(/salonId=s1/);
    await expect(page).not.toHaveURL(/date=/);
    const window = { from: shiftDay(PLATFORM_TODAY, -30), to: shiftDay(PLATFORM_TODAY, 30) };
    expect(Object.fromEntries(asked.at(-1)!)).toEqual({ salonId: 's1', ...window });

    // The Майстер picker now offers this Салон's Ростер.
    await page.getByTestId('appointments-scope-master').click();
    await page.getByRole('option', { name: 'Ion Popa' }).click();

    await expect(page).toHaveURL(/masterId=m2/);
    await expect.poll(() => asked.at(-1)?.get('masterId')).toBe('m2');
    expect(Object.fromEntries(asked.at(-1)!)).toEqual({ salonId: 's1', masterId: 'm2', ...window });
  });

  test('reopen a Клієнт’s view exactly as the address names it', async ({ page, mockBackend }) => {
    const asked: URLSearchParams[] = [];
    await mockBackend(
      ADMIN,
      routes({
        [LIST]: (url) => {
          asked.push(url.searchParams);
          return apiOk({ items: [independent] });
        },
      }),
    );

    await signIn(
      page,
      ADMIN,
      '/appointments?clientId=c1&from=2026-09-01&to=2026-09-30&status=CANCELLED',
    );

    await expect(page.getByTestId('appointment-row')).toHaveCount(1);
    expect(Object.fromEntries(asked.at(-1)!)).toEqual({
      clientId: 'c1',
      from: '2026-09-01',
      to: '2026-09-30',
      status: 'CANCELLED',
    });
    await expect(page.getByTestId('appointments-scope-client')).toContainText('Maria Client');
    await expect(page.getByTestId('appointments-filter-status')).toContainText('Скасовано');
    await expect(page.getByTestId('appointments-filter-from')).toHaveValue('2026-09-01');
    await expect(page.getByTestId('appointments-filter-to')).toHaveValue('2026-09-30');
  });

  test('open a Запис with the actions over it — a cancellation asks for its reason, and the row redraws', async ({
    page,
    mockBackend,
  }) => {
    const booked = appointment({ startTime: `${AHEAD}T06:00:00Z`, endTime: `${AHEAD}T06:45:00Z` });
    const details = {
      ...booked,
      updatedAt: '2026-09-20T10:00:00.000Z',
      clientId: 'c1',
      clientPhone: '+37360000001',
      salonName: 'Beauty Lab',
      services: [{ serviceId: 'svc1', name: 'Стрижка', durationMinutes: 45, price: 350 }],
      totalDurationMinutes: 45,
      notes: null,
    };
    const mock = await mockBackend(
      ADMIN,
      routes({
        'GET /admin/salons/s1/masters': ROSTER,
        [LIST]: apiOk({ items: [booked] }),
        'GET /admin/appointments/a1': apiOk(details),
        'PATCH /admin/appointments/a1': apiOk({ ...details, status: 'CANCELLED' }),
      }),
    );
    await signIn(page, ADMIN, '/appointments?salonId=s1');

    await page.getByTestId('appointment-row').click();
    await expect(page.getByTestId('appointment-actions')).toBeVisible();
    await page.getByTestId('appointment-action-CANCELLED').click();
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();
    await page.getByTestId('reason-input').fill('Салон не відповідає');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('appointment-row-status')).toHaveText('Скасовано');
    expect(mock.bodies['PATCH /admin/appointments/a1']).toEqual([
      { status: 'CANCELLED', updatedAt: '2026-09-20T10:00:00.000Z', reason: 'Салон не відповідає' },
    ]);
  });
});
