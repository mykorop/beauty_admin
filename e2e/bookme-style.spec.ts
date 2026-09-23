import type { Page, TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { apiError, apiOk, installApiMock } from './fixtures/api-mock';
import { installCognitoMock } from './fixtures/cognito-mock';
import {
  ADMIN,
  EMPTY_STATS,
  expect,
  signIn,
  submitPassword,
  submitTotp,
  test,
} from './fixtures/app.fixture';
import { detailedStatsResult } from './fixtures/detailed-stats';

const ME = apiOk({ adminId: 'e2e-user-sub', email: ADMIN.email });
test.use({ timezoneId: 'Europe/Chisinau' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-23T09:00:00Z'));
});

test.describe('initial document', () => {
  test.use({ javaScriptEnabled: false });
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the canvas is dark before Angular loads with a ${colorScheme} system preference`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/salons/s1/profile');
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
      await expect(page.locator('body')).toHaveCSS('color', 'rgb(245, 242, 235)');
    });
  }
});

test('native 200% browser zoom keeps sign-in, navigation and statistics usable', async ({
  playwright,
  baseURL,
}, info) => {
  // Chromium's tab zoom reflows and magnifies the page; CDP pinch zoom does not.
  // The extension and browser profile exist only in this test's output directory.
  const extension = info.outputPath('zoom-extension');
  await mkdir(extension, { recursive: true });
  await writeFile(
    `${extension}/manifest.json`,
    JSON.stringify({
      name: 'Local zoom verification',
      version: '1.0',
      manifest_version: 3,
      background: { service_worker: 'background.js' },
      permissions: ['tabs'],
    }),
  );
  await writeFile(
    `${extension}/background.js`,
    'chrome.runtime.onInstalled.addListener(() => {});',
  );
  const context = await playwright.chromium.launchPersistentContext(
    info.outputPath('zoom-profile'),
    {
      channel: 'chromium',
      headless: true,
      viewport: null,
      deviceScaleFactor: undefined,
      baseURL,
      timezoneId: 'Europe/Chisinau',
      reducedMotion: 'reduce',
      colorScheme: 'light',
      args: [
        '--window-size=1440,1000',
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    },
  );
  try {
    await installCognitoMock(context, ADMIN);
    const api = await installApiMock(context, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': apiOk({ run: null, result: detailedStatsResult() }),
    });
    const page = context.pages()[0];
    await page.clock.setFixedTime(new Date('2026-09-23T09:00:00Z'));
    await page.goto('/');
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const zoom = await worker.evaluate(`(async () => {
      const [tab] = await chrome.tabs.query({ active: true });
      await chrome.tabs.setZoom(tab.id, 2);
      return chrome.tabs.getZoom(tab.id);
    })()`);
    expect(zoom).toBe(2);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(720);
    await expect(page.getByTestId('login-email')).toBeVisible();
    await fitsViewport(page);
    await submitPassword(page, ADMIN.email);
    await submitTotp(page, '123456');
    await expect(page.getByTestId('detailed-stats-result')).toBeVisible();
    await fitsViewport(page);
    await page.getByTestId('chart-appointments-table-toggle').click();
    await expect(page.getByTestId('chart-appointments-table')).toBeVisible();
    await fitsViewport(page);
    await page.getByRole('button', { name: 'Навігація', exact: true }).click();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Навігація', exact: true })).toBeFocused();
    await page.evaluate(() => document.fonts.ready);
    // Capture the browser viewport directly: Playwright's CSS-pixel clip would crop it at tab zoom.
    const session = await context.newCDPSession(page);
    const screenshot = await session.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
    });
    await writeFile(info.outputPath('native-zoom-200.png'), Buffer.from(screenshot.data, 'base64'));
    expect(api.unmatched).toEqual([]);
  } finally {
    await context.close();
  }
});

const samples = [
  { width: 1440, height: 1000, language: 'uk' },
  { width: 1024, height: 900, language: 'ro' },
  { width: 768, height: 1000, language: 'ru' },
  { width: 390, height: 844, language: 'ro' },
  // A 1440 × 1000 desktop at 200% zoom has a 720 × 500 CSS-pixel layout viewport.
  { width: 720, height: 500, language: 'uk' },
];

async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
    style:
      '.admin-shell { height: auto; min-height: 100dvh; grid-template-rows: auto auto; } .shell-workspace { overflow: visible; }',
  });
}

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const main = page.locator('main');
  expect(await main.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
}

test('password, TOTP and refusal retain the brand and visible input states', async ({
  page,
  mockBackend,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(ADMIN, {});
  await page.goto('/login');
  await expect(page.getByText('BookMe Admin', { exact: true })).toBeVisible();
  await expect(page.locator('.bookme-brand')).toHaveCSS(
    'font-family',
    '"Instrument Serif", Georgia, serif',
  );
  await page.getByTestId('login-email').fill('wrong');
  await page.getByTestId('login-password').locator('input').focus();
  await expect(page.getByTestId('login-email')).toHaveAttribute('aria-invalid', 'true');
  await capture(page, info, 'login-password-invalid-390');
  await fitsViewport(page);
  await submitPassword(page, ADMIN.email);
  await expect(page.getByTestId('login-totp')).toBeVisible();
  await expect(page.getByTestId('login-totp').locator('input').first()).toHaveAccessibleName(/.+/);
  await capture(page, info, 'login-totp-390');
  await submitTotp(page, '000000');
  await expect(page.getByTestId('login-error')).toBeVisible();
  await capture(page, info, 'login-error-390');
  await fitsViewport(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await capture(page, info, 'login-password-1440');
});

for (const sample of samples) {
  test(`dashboard layout at ${sample.width}px in ${sample.language}`, async ({
    page,
    mockBackend,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.setViewportSize(sample);
    await page.addInitScript(
      (language) => localStorage.setItem('bookme.admin.language', language),
      sample.language,
    );
    await mockBackend(ADMIN, {
      'GET /admin/me': ME,
      'GET /admin/stats/basic': EMPTY_STATS,
      'GET /admin/stats/detailed': apiOk({ run: null, result: detailedStatsResult() }),
      'GET /admin/audit': apiOk({ items: [], nextCursor: null }),
    });
    await page.goto('/');
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', sample.language);
    await fitsViewport(page);
    if ([1440, 768, 390].includes(sample.width)) {
      await capture(page, info, `login-${sample.language}-${sample.width}`);
    }
    await submitPassword(page, ADMIN.email);
    await expect(page.getByTestId('login-totp')).toBeVisible();
    await fitsViewport(page);
    await submitTotp(page, '123456');
    await expect(page.getByTestId('detailed-stats-result')).toBeVisible();
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
    await expect(page.getByTestId('detailed-stats-run').locator('button')).toHaveCSS(
      'background-color',
      'rgb(245, 158, 12)',
    );
    await expect(page.getByTestId('detailed-stats-run').locator('button')).toHaveCSS(
      'color',
      'rgb(24, 26, 29)',
    );
    await fitsViewport(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
    await capture(page, info, `dashboard-${sample.language}-${sample.width}`);
    if (sample.width === 1440) {
      await page.screenshot({
        path: info.outputPath('shell-overview.png'),
        animations: 'disabled',
      });
      await page.getByTestId('chart-appointments').locator('svg').focus();
      await page.keyboard.press('End');
      await expect(page.getByTestId('chart-appointments-tooltip')).toBeVisible();
      await page
        .getByTestId('detailed-stats-appointments')
        .screenshot({ path: info.outputPath('chart-tooltip.png'), animations: 'disabled' });
      await page.getByTestId('chart-appointments-table-toggle').click();
      await expect(page.getByTestId('chart-appointments-table')).toBeVisible();
      await page
        .getByTestId('detailed-stats-appointments')
        .screenshot({ path: info.outputPath('chart-table.png'), animations: 'disabled' });
    }
    if (sample.width < 1024) {
      await page.getByRole('button', { name: /Навігація|Навигация|Navigare/, exact: true }).click();
      await expect(page.getByTestId('sidebar')).toBeVisible();
      await fitsViewport(page);
      await page.screenshot({
        path: info.outputPath(`navigation-${sample.width}.png`),
        animations: 'disabled',
      });
    }
    // The audit log and its body-mounted controls keep the same theme after navigation.
    await page.getByTestId('sidebar').getByRole('link').last().click();
    await expect(page).toHaveURL(/\/audit-log$/);
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(24, 26, 29)');
    await page.getByTestId('language-switcher').click();
    await expect(page.getByRole('listbox')).toHaveCSS('color', 'rgb(245, 242, 235)');
    await page.keyboard.press('Escape');
    await fitsViewport(page);
  });
}

test('failed computation preserves the previous result and the empty basic state is readable', async ({
  page,
  mockBackend,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockBackend(ADMIN, {
    'GET /admin/me': ME,
    'GET /admin/stats/basic': apiError(500, 'INTERNAL_SERVER_ERROR'),
    'GET /admin/stats/detailed': apiOk({
      run: { runId: 'failed', status: 'failed', errorCode: 'TIMED_OUT', scannedItems: 0 },
      result: detailedStatsResult(),
    }),
  });
  await signIn(page, ADMIN);
  await expect(page.getByTestId('detailed-stats-failed')).toBeVisible();
  await expect(page.getByTestId('dashboard-empty')).toBeVisible();
  await capture(page, info, 'dashboard-failure');
});
