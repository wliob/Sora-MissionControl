import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.MISSION_CONTROL_PROXY_PORT ?? 3187);
const host = process.env.MISSION_CONTROL_PROXY_HOST ?? '127.0.0.1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const adminKey = process.env.MISSION_CONTROL_ADMIN_PROXY_KEY ?? 'playwright-admin-token';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './shared/playwright-results',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run build && node missionControlProxy.js',
        env: {
          MISSION_CONTROL_PROXY_HOST: host,
          MISSION_CONTROL_PROXY_PORT: String(port),
          MISSION_CONTROL_PROXY_AUTH_MODE: 'required',
          MISSION_CONTROL_ADMIN_PROXY_KEY: adminKey,
        },
        url: `${baseURL}/health`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 950 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
    },
  ],
});
