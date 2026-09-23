import { detailedStatsResult as result } from './fixtures/detailed-stats';
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


const detailed = (state: { run: unknown; result: unknown }): MockResponse => apiOk(state);

/** The Видалений Салон the stuck Майстер of the list above is left on — as its card reads it. */
const deletedSalon = {
  salonId: 'dead',
  name: 'Salon Ex',
  ownerName: 'Dan Ex',
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
  email: 'dan@salon-ex.md',
  timezone: 'Europe/Chisinau',
  rating: 0,
  reviewCount: 0,
  bufferMinutes: 10,
  bookingForwardDays: 30,
  brandColor: null,
  language: 'ro',
  status: 'deleted',
  deletedAt: '2026-06-01T10:00:00.000Z',
  blockedAt: null,
  blockedReason: null,
  shortLinks: { random: null, handle: null },
  createdAt: '2026-01-10T22:30:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

/** His place on that Ростер. */
const stuckMaster = {
  masterId: 'm9',
  isOwner: false,
  masterName: 'Ion Rusu',
  masterAvatar: '',
  email: 'ion@bookme.md',
  specialization: 'barber',
  status: 'ACTIVE',
  commissionPercent: 40,
  bookingForwardDays: 14,
  rating: 0,
  reviewCount: 0,
  joinedAt: '2026-02-01T10:00:00.000Z',
  updatedAt: null,
};

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

test.describe('Детальна статистика: топи, якість, «Потребують уваги»', () => {
  const succeeded = () => detailed({ run: run({ status: 'succeeded' }), result: result() });

  test('the tops of the last 30 days name who pulls the platform and lead to their cards', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': succeeded(),
    });
    await signIn(page, ADMIN);

    await expect(page.getByTestId('tops-window')).toContainText('25 серпня');
    await expect(page.getByTestId('tops-window')).toContainText('23 вересня');

    const salons = page.getByTestId('top-salons');
    await expect(salons.getByTestId('top-salons-row')).toHaveCount(2);
    await expect(salons.getByTestId('top-salons-row').first()).toContainText('Beauty Lab');
    await expect(salons.getByTestId('top-salons-row').first()).toContainText('42');
    await expect(salons.getByRole('link', { name: 'Beauty Lab' })).toHaveAttribute(
      'href',
      '/salons/s1',
    );
    await expect(
      page.getByTestId('top-independentMasters').getByRole('link', { name: 'Ana Rusu' }),
    ).toHaveAttribute('href', '/independent-masters/m1');

    // A city is not a profile: nothing to open.
    const cities = page.getByTestId('top-cities');
    await expect(cities.getByTestId('top-cities-row')).toHaveCount(3);
    await expect(cities.getByRole('link')).toHaveCount(0);

    // The period cuts the charts only; the tops read their own 30 days.
    await page.getByTestId('detailed-stats-period').getByText('Рік').click();
    await expect(salons.getByTestId('top-salons-row')).toHaveCount(2);
  });

  test('the quality block counts the week and opens the moderation feed where the bad reviews are', async ({
    page,
    mockBackend,
  }) => {
    const feedQueries: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': succeeded(),
      // The feed's pickers read the cached lists.
      'GET /admin/salons': apiOk({ items: [], builtAt: '2026-09-23T09:00:00.000Z' }),
      'GET /admin/masters': apiOk({ items: [], builtAt: '2026-09-23T09:00:00.000Z' }),
      'GET /admin/reviews': (url) => {
        feedQueries.push(url.searchParams);
        return apiOk({ items: [], nextCursor: null });
      },
    });
    await signIn(page, ADMIN);

    await expect(page.getByTestId('quality-reviews')).toHaveText('12');
    await expect(page.getByTestId('quality-average')).toHaveText('4,3');
    await expect(page.getByTestId('quality-low-rated')).toHaveText('3');

    const profiles = page.getByTestId('quality-profile');
    await expect(profiles).toHaveCount(2);
    await expect(profiles.first()).toContainText('Nails & Co');
    await expect(profiles.first()).toContainText('Салон');
    await expect(profiles.nth(1)).toContainText('Майстер');

    await profiles.first().getByRole('link', { name: 'Nails & Co' }).click();

    await expect(page).toHaveURL(
      /\/reviews\?salonId=s2&from=2026-09-17&to=2026-09-23&state=visible$/,
    );
    await expect.poll(() => feedQueries.length).toBeGreaterThan(0);
    const query = feedQueries[feedQueries.length - 1];
    expect(query.get('salonId')).toBe('s2');
    expect(query.get('state')).toBe('visible');
    // The week the block read, as Chișinău lived it: 17 September 00:00 to 24 September 00:00.
    expect(query.get('from')).toBe('2026-09-16T21:00:00.000Z');
    expect(query.get('to')).toBe('2026-09-23T21:00:00.000Z');
  });

  test('«Потребують уваги» shows whoever carries any chosen flag, and says what is wrong', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': succeeded(),
    });
    await signIn(page, ADMIN);

    const rows = page.getByTestId('attention-row');
    await expect(rows).toHaveCount(3);

    const quiet = rows.filter({ hasText: 'Quiet Studio' });
    await expect(quiet).toContainText('Без Записів за 30 днів');
    await expect(quiet).toContainText('Незавершений профіль');
    await expect(quiet.getByTestId('attention-missing')).toHaveText('Бракує: опису, фото');
    await expect(quiet).toContainText('14 лип');
    await expect(quiet.getByTestId('attention-link')).toHaveAttribute('href', '/salons/s3');

    const vera = rows.filter({ hasText: 'Vera Lungu' });
    await expect(vera).toContainText('Незалежний майстер');
    await expect(vera).toContainText('Не було');
    await expect(vera.getByTestId('attention-link')).toHaveAttribute(
      'href',
      '/independent-masters/m4',
    );

    const stuck = rows.filter({ hasText: 'Ion Rusu' });
    await expect(stuck).toContainText('Майстер салону · Ростер Салону «Salon Ex»');
    await expect(stuck.getByTestId('attention-link')).toHaveAttribute(
      'href',
      '/salons/dead/masters/m9',
    );

    const filters = page.getByTestId('attention-filters');
    await expect(filters).toContainText('Без послуг · 1');
    await expect(filters).toContainText('Незавершений профіль · 1');

    await filters.getByText(/^Без послуг/).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Vera Lungu');

    // Filters add up: any of the chosen flags, not all of them.
    await filters.getByText(/^У Видаленому Салоні/).click();
    await expect(rows).toHaveCount(2);

    await filters.getByText(/^Без послуг/).click();
    await filters.getByText(/^У Видаленому Салоні/).click();
    await expect(rows).toHaveCount(3);
  });

  test('a Майстер stuck in a Видалений Салон opens where he can be taken off its Ростер', async ({
    page,
    mockBackend,
  }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': succeeded(),
      'GET /admin/salons/dead': apiOk(deletedSalon),
      'GET /admin/salons/dead/masters/m9': apiOk(stuckMaster),
    });
    await signIn(page, ADMIN);

    await page
      .getByTestId('attention-row')
      .filter({ hasText: 'Ion Rusu' })
      .getByTestId('attention-link')
      .click();

    await expect(page).toHaveURL(/\/salons\/dead\/masters\/m9\/profile$/);
    await expect(page.getByTestId('card-deleted-banner')).toBeVisible();
    await expect(page.getByTestId('master-remove')).toBeVisible();
  });

  test('with nobody to attend to, no bad review and no Запис, each section says so', async ({
    page,
    mockBackend,
  }) => {
    const quiet = result({
      tops: {
        window: { from: '2026-08-25', to: '2026-09-23' },
        salons: [],
        independentMasters: [],
        cities: [],
      },
      quality: {
        window: { from: '2026-09-17', to: '2026-09-23' },
        reviews: 0,
        averageRating: null,
        lowRated: 0,
        lowRatedProfiles: [],
      },
      attention: { window: { from: '2026-08-25', to: '2026-09-23' }, items: [] },
    });
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': detailed({ run: run({ status: 'succeeded' }), result: quiet }),
    });
    await signIn(page, ADMIN);

    await expect(page.getByTestId('top-salons')).toContainText('Жодного Запису за ці дні.');
    await expect(page.getByTestId('quality-average')).toHaveText('—');
    await expect(page.getByTestId('quality-none')).toBeVisible();
    await expect(page.getByTestId('attention-empty')).toContainText('Нікого');
    await expect(page.getByTestId('attention-filters')).toContainText('Без послуг · 0');
  });
});
