import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const REVIEWS = 'GET /admin/reviews';

const review = (overrides: Record<string, unknown> = {}) => ({
  reviewId: 'r1',
  appointmentId: 'appt-1',
  clientId: 'client-1',
  clientName: 'Maria Client',
  masterId: 'm1',
  salonId: 's1',
  masterRating: 1,
  salonRating: 2,
  comment: 'Rude and late',
  createdAt: '2026-09-21T10:00:00.000Z',
  hiddenAt: null,
  hiddenReason: null,
  ...overrides,
});

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
      name: 'Ion Popa',
      city: 'Chișinău',
      cityCode: '0100000',
      specialization: 'barber',
      email: 'm9@bookme.md',
      phone: '+37360000002',
      rating: 4.6,
      reviewCount: 7,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
});

const salonCard = (overrides: Record<string, unknown> = {}) => ({
  salonId: 's1',
  name: 'Beauty Lab',
  ownerName: 'Ana Rusu',
  description: 'Hair and nails',
  addressStreet: 'Strada Pușkin',
  addressHouseNumber: '22',
  addressCityCode: '0100000',
  addressCity: 'Chișinău',
  addressState: 'Chișinău',
  addressZipCode: 'MD-2012',
  addressCountry: 'MD',
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
  updatedAt: '2026-05-02T11:30:00.000Z',
  ...overrides,
});

test.describe('стрічка модерації відгуків', () => {
  // Far from Chișinău on purpose: the feed spans venues and runs on the platform's clock.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('asks for a profile first — there is no platform-wide feed to show', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
    });

    await signIn(page, ADMIN, '/reviews');

    await expect(page.getByTestId('section-title')).toHaveText('Відгуки');
    await expect(page.getByTestId('reviews-scope-empty')).toBeVisible();
    // Nothing was read: the backend refuses a feed that names neither a Салон nor a Майстер.
    await expect(page.getByTestId('reviews-table')).toHaveCount(0);
  });

  test('reads the chosen Салон, on the platform’s clock, and keeps it in the address', async ({
    page,
    mockBackend,
  }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: [review()], nextCursor: null });
      },
    });
    await signIn(page, ADMIN, '/reviews');

    await page.getByTestId('reviews-scope-salon').click();
    await page.getByRole('option', { name: 'Beauty Lab' }).click();

    await expect(page.getByTestId('review-row')).toHaveCount(1);
    // 10:00Z is 13:00 in Chișinău in September — not 03:00, which is what Los Angeles would show.
    await expect(page.getByTestId('review-when')).toContainText('13:00');
    await expect(page.getByTestId('review-client')).toHaveText('Maria Client');
    await expect(page.getByTestId('review-master-rating')).toHaveText('1');
    await expect(page.getByTestId('review-salon-rating')).toHaveText('2');
    await expect(page.getByTestId('review-state')).toHaveText('Видимий');
    await expect(page).toHaveURL(/salonId=s1/);
    expect(seen.at(-1)?.get('salonId')).toBe('s1');
  });

  test('sends the filters to the backend and keeps them in the address', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: url.searchParams.has('state') ? [review()] : [], nextCursor: null });
      },
    });
    await signIn(page, ADMIN, '/reviews?salonId=s1');
    await expect(page.getByTestId('reviews-empty')).toBeVisible();

    await page.getByTestId('reviews-filter-from').fill('2026-09-01');
    await page.getByTestId('reviews-filter-to').fill('2026-09-21');
    await page.getByTestId('reviews-filter-rating').click();
    await page.getByRole('option', { name: '1', exact: true }).click();
    await page.getByTestId('reviews-filter-state').click();
    await page.getByRole('option', { name: 'Видимий' }).click();

    await expect(page.getByTestId('review-row')).toHaveCount(1);
    await expect(page).toHaveURL(/rating=1/);
    await expect(page).toHaveURL(/state=visible/);

    const last = seen.at(-1);
    expect(last?.get('salonId')).toBe('s1');
    expect(last?.get('rating')).toBe('1');
    expect(last?.get('state')).toBe('visible');
    // The days become instants on the platform's clock; `to` covers the 21st in full.
    expect(last?.get('from')).toBe('2026-08-31T21:00:00.000Z');
    expect(last?.get('to')).toBe('2026-09-21T21:00:00.000Z');
  });

  test('hides a review with a reason and redraws the row from the answer', async ({ page, mockBackend }) => {
    const hidden = review({ hiddenAt: '2026-09-22T09:00:00.000Z', hiddenReason: 'Образи' });
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: apiOk({ items: [review()], nextCursor: null }),
      'POST /admin/reviews/r1/hide': apiOk(hidden),
    });
    await signIn(page, ADMIN, '/reviews?salonId=s1');

    await page.getByTestId('review-hide').click();
    // The dialog says what приховання does — and what it deliberately does not undo.
    await expect(page.getByTestId('reason-message')).toContainText('Maria Client');
    await expect(page.getByTestId('reason-message')).toContainText('перераховано');
    // The reason is mandatory: nothing is sent until there is one.
    await expect(page.getByTestId('reason-confirm')).toBeDisabled();

    await page.getByTestId('reason-input').fill('  Образи  ');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toHaveCount(0);
    await expect(page.getByTestId('review-state')).toHaveText('Прихований');
    await expect(page.getByTestId('review-hidden-reason')).toContainText('Образи');
    await expect(page.getByTestId('review-unhide')).toBeVisible();
    // Trimmed, and nothing else travels: the panel never edits the words or the scores.
    expect(mock.bodies['POST /admin/reviews/r1/hide']).toEqual([{ reason: 'Образи' }]);
  });

  test('keeps the dialog open with the reason as typed when the backend refuses', async ({ page, mockBackend }) => {
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: apiOk({ items: [review()], nextCursor: null }),
      'POST /admin/reviews/r1/hide': apiError(409, 'REVIEW_ALREADY_HIDDEN'),
    });
    await signIn(page, ADMIN, '/reviews?salonId=s1');

    await page.getByTestId('review-hide').click();
    await page.getByTestId('reason-input').fill('Образи');
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('reason-dialog')).toBeVisible();
    await expect(page.getByTestId('reason-input')).toHaveValue('Образи');
    await expect(page.getByText('Відгук уже приховано. Оновіть сторінку.')).toBeVisible();
    await expect(page.getByTestId('review-state')).toHaveText('Видимий');
  });

  test('returns a hidden review, and the reason is optional there', async ({ page, mockBackend }) => {
    const mock = await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: apiOk({
        items: [review({ hiddenAt: '2026-09-22T09:00:00.000Z', hiddenReason: 'Образи' })],
        nextCursor: null,
      }),
      'POST /admin/reviews/r1/unhide': apiOk(review()),
    });
    await signIn(page, ADMIN, '/reviews?salonId=s1');

    await expect(page.getByTestId('review-state')).toHaveText('Прихований');
    await page.getByTestId('review-unhide').click();
    // Returning a review only undoes the platform's own decision, so it is owed no explanation.
    await expect(page.getByTestId('reason-confirm')).toBeEnabled();
    await page.getByTestId('reason-confirm').click();

    await expect(page.getByTestId('review-state')).toHaveText('Видимий');
    expect(mock.bodies['POST /admin/reviews/r1/unhide']).toEqual([{}]);
  });

  test('pages the feed and says so when a filtered page comes back empty', async ({ page, mockBackend }) => {
    let call = 0;
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons': SALONS,
      'GET /admin/masters': MASTERS,
      [REVIEWS]: () => {
        call += 1;
        return call === 1
          ? apiOk({ items: [], nextCursor: 'cursor-1' })
          : apiOk({ items: [review({ reviewId: 'r2' })], nextCursor: null });
      },
    });
    await signIn(page, ADMIN, '/reviews?salonId=s1&state=hidden');

    // A rare filter may legitimately answer an empty page that still has rows below it.
    await expect(page.getByTestId('reviews-empty')).toHaveText(
      'На цій сторінці нічого не знайшлось — спробуйте показати давніші.',
    );
    await page.getByTestId('reviews-more').click();

    await expect(page.getByTestId('review-row')).toHaveCount(1);
    await expect(page.getByTestId('reviews-more')).toHaveCount(0);
  });
});

test.describe('вкладка «Відгуки» картки', () => {
  // Far from the salon's zone on purpose: a card prints — and filters on — the venue's clock.
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('reads the Салон’s own feed and says the text cannot be edited', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      [REVIEWS]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: [review()], nextCursor: null });
      },
    });

    await signIn(page, ADMIN, '/salons/s1/reviews');

    await expect(page.getByTestId('review-row')).toHaveCount(1);
    await expect(page.getByTestId('reviews-readonly')).toContainText('змінити неможливо');
    // The Салон's clock, not the platform's and not the browser's: 10:00Z is 13:00 in Chișinău.
    await expect(page.getByTestId('review-when')).toContainText('13:00');
    expect(seen.at(-1)?.get('salonId')).toBe('s1');
    expect(seen.at(-1)?.has('masterId')).toBe(false);
  });

  /**
   * The day filters of a card are cut on the venue's clock too. A Салон two hours behind the
   * platform would otherwise lose the reviews of its own last evening off the end of the window.
   */
  test('cuts the day filters on the Салон’s clock, not the platform’s', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard({ timezone: 'Europe/Lisbon' })),
      [REVIEWS]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: [], nextCursor: null });
      },
    });

    await signIn(page, ADMIN, '/salons/s1/reviews');
    await page.getByTestId('reviews-filter-from').fill('2026-09-01');

    await expect
      .poll(() => seen.at(-1)?.get('from'))
      // Midnight in Lisbon on 1 September, not in Chișinău (21:00Z the day before).
      .toBe('2026-08-31T23:00:00.000Z');
  });

  test('a Майстер салону is read inside his Салон — what he earned here', async ({ page, mockBackend }) => {
    const seen: URLSearchParams[] = [];
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/salons/s1': apiOk(salonCard()),
      'GET /admin/salons/s1/masters/m1': apiOk({
        masterId: 'm1',
        masterName: 'Ion Popa',
        masterAvatar: '',
        email: 'ion@bookme.md',
        status: 'ACTIVE',
        userId: 'm1',
        claimedAt: '2026-02-01T00:00:00.000Z',
        commissionPercent: 20,
        rating: 4.6,
        reviewCount: 7,
        specialization: 'barber',
        bookingForwardDays: 30,
        joinedAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-05-02T11:30:00.000Z',
      }),
      [REVIEWS]: (url) => {
        seen.push(url.searchParams);
        return apiOk({ items: [review()], nextCursor: null });
      },
    });

    await signIn(page, ADMIN, '/salons/s1/masters/m1/reviews');

    await expect(page.getByTestId('review-row')).toHaveCount(1);
    expect(seen.at(-1)?.get('salonId')).toBe('s1');
    expect(seen.at(-1)?.get('masterId')).toBe('m1');
  });
});
