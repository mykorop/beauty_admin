import { apiOk, type MockResponse } from './fixtures/api-mock';
import {
  ADMIN,
  EMPTY_STATS,
  NO_DETAILED_STATS,
  expect,
  signIn,
  test,
} from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });

/** The dashboard polls every two seconds; a result is two polls away at most. */
const FOLLOW = { timeout: 10_000 };

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

const growth = (day: string, salons = 0, masters = 0, clients = 0) => ({
  day,
  salons,
  masters,
  clients,
});

const appointments = (day: string, counts: Record<string, number> = {}) => ({
  day,
  upcoming: 0,
  pastBooked: 0,
  completed: 0,
  cancelled: 0,
  noShow: 0,
  ...counts,
});

/**
 * A result built at noon on Wednesday 23 September 2026. The dashboard cuts its periods from the
 * result's own `today`, never from the browser's clock, so these figures read the same any day.
 */
const result = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  builtAt: '2026-09-23T09:00:00.000Z',
  timeZone: 'Europe/Chisinau',
  ratesUpdatedAt: '2026-09-23T06:00:00.000Z',
  scannedItems: 5000,
  today: '2026-09-23',
  growth: {
    daily: [
      growth('2026-09-21', 1, 0, 4),
      growth('2026-09-22', 0, 2, 3),
      growth('2026-09-23', 0, 0, 1),
    ],
    // The week of 24 August starts before a 30-day period and is still drawn whole.
    weekly: [growth('2026-08-24', 0, 0, 5), growth('2026-09-21', 1, 2, 8)],
    undated: 0,
  },
  appointments: {
    daily: [
      // Well before the last 30 days, still inside the default 90.
      appointments('2026-07-01', { completed: 5 }),
      appointments('2026-09-22', { completed: 2, pastBooked: 3, cancelled: 1 }),
      appointments('2026-09-23', { pastBooked: 1, upcoming: 1 }),
      appointments('2026-09-24'),
      appointments('2026-09-25', { upcoming: 2, cancelled: 1 }),
    ],
    undated: 0,
  },
  value: {
    currency: 'MDL',
    daily: [
      { day: '2026-07-01', past: 2000, ahead: 0 },
      { day: '2026-09-22', past: 1500, ahead: 0 },
      { day: '2026-09-23', past: 300, ahead: 450 },
      { day: '2026-09-24', past: 0, ahead: 0 },
      { day: '2026-09-25', past: 0, ahead: 900 },
    ],
    unconverted: 0,
  },
  ...overrides,
});

const detailed = (state: { run: unknown; result: unknown }): MockResponse => apiOk(state);

test.describe('Детальна статистика', () => {
  test('before the first run the dashboard says so and offers to count', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': NO_DETAILED_STATS,
    });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('detailed-stats-never')).toContainText('ще не рахували');
    await expect(page.getByTestId('detailed-stats-run')).toContainText('Порахувати');
    await expect(page.getByTestId('detailed-stats-result')).toHaveCount(0);
  });

  test('«Порахувати» starts a run, follows it to its end and draws the result', async ({
    page,
    mockBackend,
  }) => {
    let started = false;
    let polls = 0;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': () => {
        if (!started) {
          return NO_DETAILED_STATS;
        }
        polls += 1;
        return polls === 1
          ? detailed({ run: run({ scannedItems: 1250, estimatedItems: 5000 }), result: null })
          : detailed({
              run: run({
                status: 'succeeded',
                finishedAt: '2026-09-23T09:01:00.000Z',
                scannedItems: 5000,
              }),
              result: result(),
            });
      },
      'POST /admin/stats/detailed': () => {
        started = true;
        return { status: 202, ...apiOk(run()) };
      },
    });
    await signIn(page, ADMIN);
    await expect(page.getByTestId('detailed-stats-never')).toBeVisible();

    await page.getByTestId('detailed-stats-run').click();

    // Followed: the share of the table read so far, while the backend reads it.
    await expect(page.getByTestId('detailed-stats-progress-text')).toContainText(
      /Прочитано 1\s?250 з ≈ 5\s?000 рядків/,
      FOLLOW,
    );
    // …and then the result, drawn, with when it was built.
    await expect(page.getByTestId('detailed-stats-result')).toBeVisible(FOLLOW);
    await expect(page.getByTestId('detailed-stats-progress')).toHaveCount(0);
    await expect(page.getByTestId('detailed-stats-built-at')).toContainText('Побудовано');
    await expect(page.getByTestId('detailed-stats-rates')).toContainText('Курс валют від');

    await expect(page.getByTestId('growth-total-clients')).toHaveText('+8');
    await expect(page.getByTestId('chart-growth-salons')).toBeVisible();

    // 16 Записи in the default 90 days. The share counts the 13 due by today, 1 of them cancelled —
    // the days ahead have not had their cancellations yet.
    await expect(page.getByTestId('appointments-total')).toHaveText('16');
    await expect(page.getByTestId('appointments-cancellation-share')).toHaveText(/7,7\s?%/);
    await expect(page.getByTestId('chart-appointments-legend')).toContainText(
      'Минулі «заброньовано»',
    );

    await expect(page.getByTestId('value-past')).toHaveText(/3\s?800 MDL/);
    await expect(page.getByTestId('value-ahead')).toHaveText(/1\s?350 MDL/);
    await expect(page.getByTestId('value-not-revenue')).toContainText('Це не виручка');

    expect(mock.bodies['POST /admin/stats/detailed']).toHaveLength(1);
    // Following has stopped with the run: the button is no longer busy.
    await expect(page.getByTestId('detailed-stats-run').locator('button')).toBeEnabled();
  });

  test('a dashboard opened while a run is reading follows it, the last result shown meanwhile', async ({
    page,
    mockBackend,
  }) => {
    let polls = 0;
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': () =>
        polls++ === 0
          ? detailed({
              run: run({ runId: 'run-2', scannedItems: 400, estimatedItems: null }),
              result: result(),
            })
          : detailed({
              run: run({ runId: 'run-2', status: 'succeeded', scannedItems: 5200 }),
              result: result({ runId: 'run-2', builtAt: '2026-09-23T12:00:00.000Z' }),
            }),
    });

    await signIn(page, ADMIN);

    // No estimate: the count alone, and the previous result on screen.
    await expect(page.getByTestId('detailed-stats-progress-text')).toHaveText(
      /Прочитано 400 рядків/,
    );
    await expect(page.getByTestId('detailed-stats-result')).toBeVisible();
    await expect(page.getByTestId('detailed-stats-progress')).toHaveCount(0, FOLLOW);
    expect(polls).toBeGreaterThan(1);
    expect(mock.bodies['POST /admin/stats/detailed']).toBeUndefined();
  });

  test('a run that ran out of time says so, and the previous result stays', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': detailed({
        run: run({
          runId: 'run-2',
          status: 'failed',
          errorCode: 'TIMED_OUT',
          scannedItems: 90_000,
        }),
        result: result(),
      }),
    });

    await signIn(page, ADMIN);

    await expect(page.getByTestId('detailed-stats-failed')).toContainText(
      'не встигло за 15 хвилин',
    );
    await expect(page.getByTestId('detailed-stats-failed')).toContainText(
      'результат попереднього обчислення',
    );
    await expect(page.getByTestId('appointments-total')).toHaveText('16');
    await expect(page.getByTestId('detailed-stats-run').locator('button')).toBeEnabled();
  });

  test('the period and the growth step re-cut what is here without asking the backend', async ({
    page,
    mockBackend,
  }) => {
    let reads = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': () => {
        reads += 1;
        return detailed({ run: run({ status: 'succeeded' }), result: result() });
      },
    });
    await signIn(page, ADMIN);
    await expect(page.getByTestId('appointments-total')).toHaveText('16');

    await page.getByTestId('detailed-stats-period').getByText('30 днів').click();

    // The 1 July day falls out; what is booked ahead stays in every period.
    await expect(page.getByTestId('appointments-total')).toHaveText('11');
    await expect(page.getByTestId('appointments-cancellation-share')).toHaveText(/12,5\s?%/);
    await expect(page.getByTestId('value-past')).toHaveText(/1\s?800 MDL/);
    await expect(page.getByTestId('value-ahead')).toHaveText(/1\s?350 MDL/);

    await expect(page.getByTestId('growth-total-clients')).toHaveText('+8');

    await page.getByTestId('detailed-stats-step').getByText('По тижнях').click();
    await page.getByTestId('chart-growth-clients-table-toggle').click();

    const weeks = page.getByTestId('chart-growth-clients-table');
    await expect(weeks).toContainText('Тиждень з 21 вересня');
    await expect(weeks).toContainText('Тиждень з 24 серпня');
    // The period's figure, not the sum of the weeks drawn: it must not move with the step.
    await expect(page.getByTestId('growth-total-clients')).toHaveText('+8');
    expect(reads).toBe(1);
  });

  test('hovering a day of the Записи chart lists every state of it', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': detailed({
        run: run({ status: 'succeeded' }),
        result: result(),
      }),
    });
    await signIn(page, ADMIN);
    await page.getByTestId('detailed-stats-period').getByText('30 днів').click();
    const chart = page.getByTestId('chart-appointments').locator('svg');
    const box = (await chart.boundingBox())!;

    // The last column: Friday 25 September, two booked ahead and one cancelled.
    await chart.hover({ position: { x: box.width - 12, y: box.height / 2 } });

    const tooltip = page.getByTestId('chart-appointments-tooltip');
    await expect(tooltip).toContainText('25 вересня 2026');
    await expect(tooltip).toContainText('Заброньовано наперед');
    await expect(tooltip).toContainText('Усього: 3');
  });
});
