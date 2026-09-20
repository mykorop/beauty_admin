import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env['CI']);
const PORT = 4300;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end suite. The app is served in its `e2e` configuration, whose Cognito pool and
 * `admin-api` origin do not exist: every spec answers both from its own mocks, so the suite needs
 * no backend, no credentials and no TOTP device. The app is zoneless, so waits come from the DOM
 * or the network — never from a fixed delay.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx ng serve --configuration e2e --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 300_000,
  },
});
