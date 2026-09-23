import type { Page, TestInfo } from '@playwright/test';
import { apiError, apiOk } from './fixtures/api-mock';
import { ADMIN, expect, signIn, test } from './fixtures/app.fixture';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
const DATE = '2026-09-23T09:00:00.000Z';
const salon = {
  salonId: 's1',
  name: 'Atelier de frumusețe — îngrijire și înfrumusețare',
  ownerName: 'Олександра Константинопольська',
  description: 'Догляд за волоссям та нігтями',
  city: 'Chișinău',
  cityCode: '0100000',
  addressCity: 'Chișinău',
  addressCityCode: '0100000',
  addressStreet: 'Strada Mitropolit Gavriil Bănulescu-Bodoni',
  addressHouseNumber: '22',
  addressState: '',
  addressZipCode: 'MD-2012',
  addressCountry: 'Moldova',
  locationLatitude: '47.0245',
  locationLongitude: '28.8323',
  phone: '+37360000001',
  email: 'alexandra.konstantinopolska@atelier-frumusete.example',
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
  createdAt: DATE,
  updatedAt: DATE,
};

const service = {
  serviceId: 'svc1',
  name: 'Відновлення та професійний догляд за волоссям',
  description: 'Îngrijire completă',
  category: 'haircut',
  durationMinutes: 30,
  price: 500,
  currency: 'MDL',
  priceUnit: '',
  isActive: true,
  masterCopyCount: 1,
  createdAt: DATE,
  updatedAt: DATE,
};
const rosterMaster = {
  masterId: 'm2',
  masterName: 'Олександра Константинопольська',
  email: salon.email,
  masterAvatar: '',
  isOwner: false,
  specialization: 'barber',
  status: 'ACTIVE',
  commissionPercent: 40,
  bookingForwardDays: 14,
  rating: 4.6,
  reviewCount: 7,
  joinedAt: DATE,
  updatedAt: DATE,
};
const independentMaster = {
  ...salon,
  masterId: 'm1',
  name: 'Олександра Константинопольська',
  specialization: 'barber',
  salon: null,
};
const client = {
  clientId: 'c1',
  name: 'Олександра Константинопольська',
  firstName: 'Олександра',
  lastName: 'Константинопольська',
  email: salon.email,
  phone: salon.phone,
  avatarUrl: '',
  language: 'uk',
  status: 'active',
  deletedAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: DATE,
  updatedAt: DATE,
};
const servicesRoutes = {
  'GET /admin/me': ME,
  'GET /admin/salons/s1': apiOk(salon),
  'GET /admin/salons/s1/masters/m2': apiOk(rosterMaster),
  'GET /admin/salons/s1/services': apiOk({ items: [service] }),
  'GET /admin/dictionaries': apiOk({
    serviceCategories: ['haircut'],
    specializations: ['barber'],
    serviceCurrencies: ['MDL'],
  }),
  'GET /admin/salons/s1/masters/m2/services': apiOk({
    items: [
      {
        ...service,
        price: 700,
        durationMinutes: 45,
        catalog: { price: 500, durationMinutes: 30, isActive: true },
      },
    ],
  }),
  'GET /admin/salons/s1/masters': apiOk({
    items: [
      { ...rosterMaster, masterId: 's1', masterName: 'Ana Rusu', isOwner: true },
      rosterMaster,
      { ...rosterMaster, masterId: 'm3', masterName: 'Колишній майстер', status: 'INACTIVE' },
    ],
  }),
  'GET /admin/salons/s1/invites': apiOk({
    items: [
      {
        inviteId: 'i1',
        email: salon.email,
        specialization: 'barber',
        commissionPercent: 35,
        status: 'SENT',
        respondedAt: null,
        deliveryFailed: true,
        createdAt: DATE,
        expiresAt: '2026-09-30T09:00:00.000Z',
      },
    ],
    nextCursor: null,
  }),
};

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
}

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  // Keep representative evidence, not every combination of language, size and state.
  const width = page.viewportSize()!.width;
  const captures: Record<number, string[]> = {
    1440: ['list-filter', 'profile', 'catalogue', 'copies', 'roster', 'invites'],
    1024: ['catalogue-form'],
    768: ['copy-form', 'master-form'],
    390: ['list-filter', 'profile-invalid', 'reason', 'reason-busy', 'reason-error', 'client'],
    720: ['reason'],
  };
  if (!captures[width]?.includes(name)) return;
  await page.screenshot({
    path: info.outputPath(`${name}-${width}.png`),
    fullPage: !name.startsWith('reason'),
    animations: 'disabled',
  });
}

test.use({ timezoneId: 'Europe/Chisinau', reducedMotion: 'reduce', colorScheme: 'light' });
const samples = [
  { width: 1440, height: 1000, language: 'uk' },
  { width: 1024, height: 900, language: 'ro' },
  { width: 768, height: 1000, language: 'ru' },
  { width: 390, height: 844, language: 'ro' },
  // Layout viewport of a 1440 × 1000 desktop at 200% zoom.
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

    test('profile list keeps statuses and an open filter readable', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, {
        'GET /admin/me': ME,
        'GET /admin/masters': apiOk({ builtAt: DATE, items: [independentMaster] }),
        'GET /admin/clients': apiOk({ builtAt: DATE, items: [client] }),
        'GET /admin/salons': apiOk({
          builtAt: DATE,
          items: [
            salon,
            { ...salon, salonId: 's2', name: 'Înfrumusețare', status: 'blocked' },
            { ...salon, salonId: 's3', name: 'Салон із видаленим профілем', status: 'deleted' },
          ],
        }),
      });
      await signIn(page, ADMIN, '/salons?status=all');
      await expect(page.getByTestId('salon-row')).toHaveCount(3);
      await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
      await fitsViewport(page);
      await page.getByTestId('salons-status-filter').click();
      await expect(page.getByRole('listbox')).toHaveCSS('color', 'rgb(245, 242, 235)');
      await fitsViewport(page);
      await capture(page, info, 'list-filter');
      for (const [url, row] of [
        ['/independent-masters', 'master-row'],
        ['/clients', 'client-row'],
      ]) {
        await page.goto(url);
        await expect(page.getByTestId(row)).toHaveCount(1);
        await fitsViewport(page);
      }
    });

    test('profile form and reason dialog fit the viewport and return keyboard focus', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, {
        'GET /admin/me': ME,
        'GET /admin/salons/s1': apiOk(salon),
        'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 2 }),
        'GET /admin/masters/m1': apiOk(independentMaster),
        'GET /admin/clients/c1': apiOk(client),
        'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
        'POST /admin/salons/s1/block': apiError(500, 'INTERNAL_SERVER_ERROR'),
      });
      await signIn(page, ADMIN, '/salons/s1/profile');
      await expect(page.getByTestId('field-brandColor').locator('span')).toHaveCSS(
        'background-color',
        'rgb(170, 51, 102)',
      );
      await fitsViewport(page);
      await capture(page, info, 'profile');
      await page.getByTestId('profile-edit').click();
      await page.getByTestId('edit-name').fill('');
      await expect(page.getByTestId('edit-save')).toBeDisabled();
      await fitsViewport(page);
      await capture(page, info, 'profile-invalid');
      await page.getByTestId('edit-cancel').click();
      await page.getByTestId('block-open').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByTestId('reason-input')).toBeFocused();
      await page.getByTestId('reason-input').fill('Перевірка причини — solicitarea proprietarului');
      // Tab and reverse-tab remain inside the modal, with a visible focus indicator.
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
        expect(
          await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement)),
        ).toBe(true);
      }
      await page.getByTestId('reason-input').focus();
      await expect(page.getByTestId('reason-input')).toHaveCSS('outline-style', 'solid');
      await fitsViewport(page);
      const box = await page.getByRole('dialog').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(sample.width);
      await capture(page, info, 'reason');
      if (sample.width === 390) {
        // Hold the existing request so the busy presentation can be inspected deterministically.
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route('**/admin/salons/s1/block', async (route) => {
          await held;
          await route.fallback();
        });
        await page.getByTestId('reason-confirm').click();
        await expect(page.getByTestId('reason-confirm')).toBeDisabled();
        await expect(page.getByTestId('reason-cancel')).toBeDisabled();
        await page.keyboard.press('Tab');
        expect(
          await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement)),
        ).toBe(true);
        await page.keyboard.press('Escape');
        await page.locator('.p-dialog-mask').click({ position: { x: 2, y: 2 } });
        await expect(page.getByRole('dialog')).toBeVisible();
        await capture(page, info, 'reason-busy');
        release();
        await expect(page.locator('.p-toast-message')).toBeVisible();
        await expect(page.getByTestId('reason-input')).toHaveValue(
          'Перевірка причини — solicitarea proprietarului',
        );
        await expect(page.getByTestId('reason-confirm')).toBeEnabled();
        expect(
          await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement)),
        ).toBe(true);
        await capture(page, info, 'reason-error');
      }
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('block-open')).toBeFocused();
      await page.locator('a[data-testid="card-tab"][href$="/history"]').click();
      await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
      await fitsViewport(page);
      await page.goto('/independent-masters/m1/profile');
      await expect(page.getByTestId('field-specialization')).toBeVisible();
      await fitsViewport(page);
      await page.getByTestId('profile-edit').click();
      await expect(page.getByTestId('edit-specialization')).toBeVisible();
      await fitsViewport(page);
      await capture(page, info, 'master-form');
      await page.goto('/clients/c1/profile');
      await expect(page.getByTestId('client-readonly')).toBeVisible();
      await fitsViewport(page);
      await capture(page, info, 'client');
    });

    test('catalogue, copies, roster and invites scroll locally', async ({
      page,
      mockBackend,
    }, info) => {
      await mockBackend(ADMIN, servicesRoutes);
      await signIn(page, ADMIN, '/salons/s1/services');
      await expect(page.getByTestId('service-row')).toHaveCount(1);
      await fitsViewport(page);
      await capture(page, info, 'catalogue');
      await page.getByTestId('service-edit').click();
      await expect(page.getByTestId('service-form')).toBeVisible();
      await fitsViewport(page);
      await capture(page, info, 'catalogue-form');
      for (const [tab, row] of [
        ['roster', 'roster-row'],
        ['invites', 'invite-row'],
      ]) {
        await page.locator(`a[data-testid="card-tab"][href$="/${tab}"]`).click();
        await expect(page.getByTestId(row).first()).toBeVisible();
        await fitsViewport(page);
        await capture(page, info, tab);
      }
      await page.goto('/salons/s1/masters/m2/profile');
      await expect(page.getByTestId('field-commission')).toBeVisible();
      await fitsViewport(page);
      await page.getByTestId('master-edit').click();
      await expect(page.getByTestId('edit-commissionPercent')).toBeVisible();
      await fitsViewport(page);
      await page.locator('a[data-testid="card-tab"][href$="/services"]').click();
      await expect(page.getByTestId('copy-row')).toHaveCount(1);
      await fitsViewport(page);
      await capture(page, info, 'copies');
      await page.getByTestId('copy-edit').click();
      await expect(page.getByTestId('copy-form')).toBeVisible();
      await fitsViewport(page);
      await capture(page, info, 'copy-form');
    });
  });
}

test('chained reason dialogs return focus to the original profile action', async ({
  page,
  mockBackend,
}) => {
  await mockBackend(ADMIN, {
    'GET /admin/me': ME,
    'GET /admin/salons/s1': apiOk(salon),
    'GET /admin/salons/s1/appointments/upcoming-count': apiOk({ count: 2 }),
  });
  await signIn(page, ADMIN, '/salons/s1/profile');
  await page.getByTestId('block-open').click();
  await page.getByTestId('block-upcoming-cancel').click();
  await expect(page.getByRole('dialog', { name: 'Масове скасування Записів' })).toBeVisible();
  await expect(page.getByTestId('reason-input')).toHaveCount(1);
  await expect(page.getByTestId('reason-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('block-open')).toBeFocused();
});

test('review reason dialogs return focus inside the themed tab', async ({
  page,
  mockBackend,
}) => {
  await mockBackend(ADMIN, {
    'GET /admin/me': ME,
    'GET /admin/salons/s1': apiOk(salon),
    'GET /admin/reviews': apiOk({
      items: [
        {
          reviewId: 'r1',
          appointmentId: 'a1',
          clientId: 'c1',
          clientName: 'Maria',
          masterId: 'm2',
          salonId: 's1',
          masterRating: 1,
          salonRating: 2,
          comment: 'Review text',
          createdAt: DATE,
          hiddenAt: null,
          hiddenReason: null,
        },
      ],
      nextCursor: null,
    }),
  });
  await signIn(page, ADMIN, '/salons/s1/reviews');
  const trigger = page.getByTestId('review-hide');
  await page.keyboard.press('Tab');
  await trigger.focus();
  await expect(trigger).toHaveCSS('outline-color', 'rgb(245, 158, 12)');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reason-input')).toBeFocused();
  await expect(page.getByTestId('reason-input')).toHaveCSS('outline-color', 'rgb(245, 158, 12)');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
