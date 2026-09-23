import type { Page, TestInfo } from '@playwright/test';
import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const DATE = '2026-09-23T09:00:00.000Z';
const NAME = 'Олександра Константинопольська — Îngrijire și înfrumusețare';
const LONG = 'Довге значення fără spații: ' + 'Аăîșțґєії'.repeat(18);
const profile = {
  salonId: 's1',
  masterId: 'm1',
  clientId: 'c1',
  name: NAME,
  ownerName: NAME,
  firstName: 'Олександра',
  lastName: 'Константинопольська',
  timezone: 'Europe/Chisinau',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  salon: null,
  language: 'uk',
  specialization: 'barber',
  createdAt: DATE,
  updatedAt: DATE,
  shortLinks: { random: null, handle: null },
};
const review = {
  reviewId: 'r1',
  appointmentId: 'appt-2026-09-23',
  clientId: 'c1',
  clientName: NAME,
  salonId: 's1',
  masterId: 'm1',
  masterRating: 2,
  salonRating: 3,
  comment: LONG,
  createdAt: DATE,
  hiddenAt: null,
  hiddenReason: null,
};
const reviews = apiOk({
  items: [
    review,
    {
      ...review,
      reviewId: 'r2',
      appointmentId: 'appt-2026-09-22',
      hiddenAt: DATE,
      hiddenReason: 'Образливі висловлювання — ' + LONG,
    },
  ],
  nextCursor: null,
});
const PHOTO = 'https://assets.example.test/gallery.svg';
const SCAN = 'https://assets.example.test/certificate.svg';
const AVATAR = 'https://assets.example.test/avatar.svg';
const media = {
  avatarUrl: AVATAR,
  images: [PHOTO],
  certificates: [
    {
      certificateId: 'cert1',
      title: NAME,
      issuer: LONG,
      credentialId: LONG,
      issuedAt: '2024-05-01T00:00:00.000Z',
      expiresAt: '2027-05-01T00:00:00.000Z',
      verificationUrl: 'https://verify.example.test/cert1',
      notes: LONG,
      fileUrl: SCAN,
    },
    {
      certificateId: 'cert2',
      title: 'Сертифікат без скана',
      issuer: NAME,
      issuedAt: DATE,
      expiresAt: null,
      fileUrl: '',
    },
  ],
};
async function mockImages(page: Page) {
  await page.route('https://assets.example.test/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body:
        route.request().url() === SCAN
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#fff8e7"/><rect x="12" y="12" width="296" height="216" fill="none" stroke="#174e68" stroke-width="4"/><text x="160" y="80" text-anchor="middle" fill="#174e68" font-size="26">CERTIFICAT</text><path d="M60 130h200M60 155h200M60 180h120" stroke="#174e68" stroke-width="3"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#579bb1"/><circle cx="100" cy="90" r="50" fill="#ffcb77"/><path d="M0 240L100 120L200 200L270 90L320 150V240" fill="#496f5d"/></svg>',
    }),
  );
}
const audit = {
  auditId: 'a1',
  adminId: 'e2e-user-sub',
  adminEmail: 'alexandra.' + 'long'.repeat(15) + '@example.test',
  targetType: 'salon',
  targetId: 's1',
  salonId: 's1',
  action: 'salon.profile.update',
  createdAt: DATE,
  reason: LONG,
  affected: [],
  changes: [
    {
      field: 'description',
      before: 'Попереднє значення. ' + LONG,
      after: 'Нове значення. ' + LONG,
    },
  ],
};
const routes = {
  'GET /admin/me': apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email }),
  'GET /admin/salons': apiOk({ builtAt: DATE, items: [profile] }),
  'GET /admin/masters': apiOk({ builtAt: DATE, items: [profile] }),
  'GET /admin/salons/s1': apiOk(profile),
  'GET /admin/masters/m1': apiOk(profile),
  'GET /admin/clients/c1': apiOk(profile),
  'GET /admin/salons/s1/masters/m1': apiOk({ ...profile, masterName: NAME, status: 'ACTIVE' }),
  'GET /admin/reviews': reviews,
  'GET /admin/clients/c1/reviews': reviews,
};

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: !name.includes('dialog'),
    animations: 'disabled',
  });
}

test.use({ timezoneId: 'Europe/Chisinau', reducedMotion: 'reduce', colorScheme: 'light' });
const samples = [
  { width: 1440, height: 1000, language: 'uk' },
  { width: 1024, height: 900, language: 'ro' },
  { width: 768, height: 1000, language: 'ru' },
  { width: 390, height: 844, language: 'ro' },
  // Equivalent layout viewport to 1440 × 1000 at 200% browser zoom.
  { width: 720, height: 500, language: 'uk' },
];
for (const sample of samples) {
  test.describe(`${sample.width}px ${sample.language}`, () => {
    test.use({ viewport: { width: sample.width, height: sample.height } });
    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(new Date(DATE));
      await page.addInitScript(
        (language) => localStorage.setItem('bookme.admin.language', language),
        sample.language,
      );
    });

    test('audit filters, expanded values and all profile histories remain readable', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, {
        ...routes,
        'GET /admin/audit': apiOk({ items: [audit], nextCursor: null }),
      });
      await signIn(page, ADMIN, '/audit-log?targetType=salon&action=salon.profile.update');
      await expect(page.getByTestId('audit-row')).toHaveCount(1);
      await expect(page.getByTestId('audit-table')).toHaveCSS(
        'background-color',
        'rgb(30, 32, 36)',
      );
      await fitsViewport(page);
      await page.getByTestId('audit-row-toggle').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('audit-row-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByTestId('history-change')).toContainText(audit.changes[0].before);
      await expect(page.getByTestId('history-change')).toContainText(audit.changes[0].after);
      await fitsViewport(page);
      if (sample.width === 1440) await capture(page, info, 'audit-details-1440');
      await page.getByTestId('audit-filter-action').click();
      await expect(page.getByRole('listbox')).toHaveCSS('color', 'rgb(245, 242, 235)');
      await fitsViewport(page);
      if (sample.width === 1024) await capture(page, info, 'audit-filter-1024');
      await page.keyboard.press('Escape');
      if (sample.width === 390) {
        const region = page.getByRole('region', { name: 'Jurnal de acțiuni' });
        await region.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
      }
      for (const path of [
        '/salons/s1/history',
        '/independent-masters/m1/history',
        '/clients/c1/history',
      ]) {
        await page.goto(path);
        await expect(page.getByTestId('history-entry')).toHaveCSS(
          'background-color',
          'rgb(30, 32, 36)',
        );
        await expect(page.getByTestId('history-reason')).toContainText(LONG);
        await fitsViewport(page);
        if (path === '/salons/s1/history' && (sample.width === 1440 || sample.width === 390))
          await capture(page, info, `history-${sample.width}`);
      }
    });

    test('media cards keep original assets, long certificate details and deletion dialog usable', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, {
        ...routes,
        'GET /admin/salons/s1/media': apiOk({ ...media, avatarUrl: null }),
        'GET /admin/masters/m1/media': apiOk(media),
        'DELETE /admin/salons/s1/images': apiError(409, 'EDIT_CONFLICT'),
      });
      await mockImages(page);
      await signIn(page, ADMIN, '/salons/s1/media');
      await expect(page.getByTestId('media-certificate').first()).toHaveCSS(
        'background-color',
        'rgb(30, 32, 36)',
      );
      await expect(page.getByTestId('media-certificate-title').first()).toHaveText(NAME);
      await expect(page.getByTestId('media-certificate-noscan')).toBeVisible();
      await fitsViewport(page);
      const scan = page.getByTestId('media-certificate-scan');
      await expect(scan).toHaveCSS('filter', 'none');
      await expect(scan).toHaveCSS('object-fit', 'contain');
      expect(await scan.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(320);
      if (sample.width === 1440 || sample.width === 390)
        await capture(page, info, `media-${sample.width}`);
      if (sample.width === 1440) {
        await page
          .getByTestId('media-certificate')
          .first()
          .screenshot({ path: info.outputPath('certificate-1440.png'), animations: 'disabled' });
      }
      const trigger = page.getByTestId('media-photo-delete');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('reason-input')).toBeFocused();
      await expect(page.getByTestId('reason-confirm')).toBeDisabled();
      await page.getByTestId('reason-input').fill('Чуже фото — solicitarea proprietarului');
      await fitsViewport(page);
      if (sample.width === 1440 || sample.width === 720)
        await capture(page, info, `media-dialog-${sample.width}`);
      if (sample.width === 390) {
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/admin/salons/s1/images', async (route) => {
          await held;
          await route.fallback();
        });
        await page.getByTestId('reason-confirm').click();
        await expect(page.getByTestId('reason-confirm')).toBeDisabled();
        await expect(page.getByTestId('reason-cancel')).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeVisible();
        await capture(page, info, 'media-dialog-busy-390');
        release();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByTestId('reason-input')).toHaveValue(
          'Чуже фото — solicitarea proprietarului',
        );
        await expect(page.getByTestId('reason-confirm')).toBeEnabled();
        await capture(page, info, 'media-dialog-refusal-390');
      }
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await page.goto('/independent-masters/m1/media');
      await expect(page.getByTestId('media-avatar-image')).toBeVisible();
      await expect(page.getByTestId('media-avatar-image')).toHaveCSS('filter', 'none');
      await fitsViewport(page);
      if (sample.width === 768) await capture(page, info, 'master-media-768');
    });

    test('reviews wrap long text, scroll locally and preserve modal keyboard focus', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, routes);
      await signIn(page, ADMIN, '/reviews?salonId=s1');
      await expect(page.getByTestId('review-row')).toHaveCount(2);
      await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
      await expect(page.getByTestId('reviews-table')).toHaveCSS(
        'background-color',
        'rgb(30, 32, 36)',
      );
      await expect(page.getByTestId('review-comment').first()).toHaveText(LONG);
      await expect(page.getByTestId('review-row').first()).toContainText(review.appointmentId);
      expect(
        await page
          .getByTestId('review-row')
          .locator('td')
          .evaluateAll((cells) =>
            cells
              .filter((cell) => cell.scrollWidth > cell.clientWidth)
              .map((cell) => cell.textContent),
          ),
      ).toEqual([]);
      await fitsViewport(page);
      if (sample.width === 1440) await capture(page, info, 'reviews-1440');
      await page.getByTestId('reviews-filter-state').click();
      await expect(page.getByRole('listbox')).toHaveCSS('color', 'rgb(245, 242, 235)');
      await fitsViewport(page);
      if (sample.width === 390) await capture(page, info, 'review-filter-390');
      await page.keyboard.press('Escape');
      const trigger = page.getByTestId('review-hide');
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('reason-input')).toBeFocused();
      await expect(page.getByTestId('reason-confirm')).toBeDisabled();
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
        expect(
          await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement)),
        ).toBe(true);
      }
      await fitsViewport(page);
      if (sample.width === 720) await capture(page, info, 'review-dialog-720');
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveCSS('outline-color', 'rgb(245, 158, 12)');
      // The same shared table serves all four profile kinds.
      for (const path of [
        '/salons/s1/reviews',
        '/independent-masters/m1/reviews',
        '/salons/s1/masters/m1/reviews',
        '/clients/c1/reviews',
      ]) {
        await page.goto(path);
        await expect(page.getByTestId('review-row')).toHaveCount(2);
        await fitsViewport(page);
        await expect(page.getByTestId('reviews-table')).toHaveCSS(
          'background-color',
          'rgb(30, 32, 36)',
        );
      }
    });
  });
}

test('loading, refusal and empty states stay readable with existing retry actions', async ({
  page,
  mockBackend,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date(DATE));
  let refusal = true;
  const emptyPage = () =>
    refusal ? apiError(500, 'INTERNAL_SERVER_ERROR') : apiOk({ items: [], nextCursor: null });
  await mockBackend(ADMIN, {
    ...routes,
    'GET /admin/audit': emptyPage,
    'GET /admin/reviews': emptyPage,
    'GET /admin/salons/s1/media': () =>
      refusal
        ? apiError(500, 'INTERNAL_SERVER_ERROR')
        : apiOk({ avatarUrl: null, images: [], certificates: [] }),
  });
  for (const [path, endpoint, prefix, empty] of [
    ['/reviews?salonId=s1', '**/admin/reviews?*', 'reviews', 'reviews-empty'],
    ['/audit-log', '**/admin/audit', 'audit', 'audit-empty'],
    ['/salons/s1/history', '**/admin/audit?*', 'history', 'history-empty'],
    ['/salons/s1/media', '**/admin/salons/s1/media', 'media', 'media-gallery-empty'],
  ]) {
    refusal = true;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(endpoint, async (route) => {
      await held;
      await route.fallback();
    });
    if (prefix === 'reviews') await signIn(page, ADMIN, path);
    else await page.goto(path);
    await expect(page.getByTestId(`${prefix}-loading`)).toHaveCSS('color', 'rgb(185, 185, 192)');
    await fitsViewport(page);
    release();
    await expect(page.getByTestId(`${prefix}-failed`)).toHaveCSS('color', 'rgb(252, 165, 165)');
    await fitsViewport(page);
    if (prefix === 'media') await capture(page, info, 'media-failed-390');
    refusal = false;
    await page.unroute(endpoint);
    if (prefix === 'reviews' || prefix === 'audit')
      await page.getByTestId(`${prefix}-refresh`).click();
    else await page.reload();
    await expect(page.getByTestId(empty)).toBeVisible();
    await fitsViewport(page);
    if (prefix === 'history') await capture(page, info, 'history-empty-390');
  }
});

test('unavailable previews keep a readable label and successful removal returns focus', async ({
  page,
  mockBackend,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date(DATE));
  await mockBackend(ADMIN, {
    ...routes,
    'GET /admin/masters/m1/media': apiOk(media),
    'DELETE /admin/masters/m1/images': apiOk({ ...media, images: [] }),
  });
  await page.route('https://assets.example.test/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await signIn(page, ADMIN, '/independent-masters/m1/media');
  await expect(page.getByTestId('media-unavailable')).toHaveCount(3);
  await expect(page.getByTestId('media-unavailable').first()).toHaveText('Зображення недоступне');
  await fitsViewport(page);
  await capture(page, info, 'media-unavailable-390');
  await page.getByTestId('media-photo-delete').click();
  await page.getByTestId('reason-input').fill('Чуже фото');
  await page.getByTestId('reason-confirm').click();
  await expect(page.getByTestId('media-gallery-empty')).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
});
