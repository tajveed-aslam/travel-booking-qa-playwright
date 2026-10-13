import { defineConfig, devices } from '@playwright/test';
import { env } from './utils/env';

const isCI = !!process.env.CI;

/**
 * Two kinds of project:
 * - `api`: the Restful-Booker API tests. They make HTTP calls only, so running them once per browser would just
 *   send the same requests five times; they run once, in their own project.
 * - five UI projects (desktop Chromium, Firefox, WebKit; Pixel 7 and iPhone 14 emulation) for BlazeDemo.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // These are shared public practice sites: keep the load small.
  workers: isCI ? 2 : 4,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  // Baselines differ per OS (font rendering), so the platform is part of the path.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiBaseUrl, extraHTTPHeaders: { Accept: 'application/json' } },
    },
    { name: 'chromium', testDir: './tests/ui', use: { ...devices['Desktop Chrome'], baseURL: env.uiBaseUrl } },
    { name: 'firefox', testDir: './tests/ui', use: { ...devices['Desktop Firefox'], baseURL: env.uiBaseUrl } },
    { name: 'webkit', testDir: './tests/ui', use: { ...devices['Desktop Safari'], baseURL: env.uiBaseUrl } },
    { name: 'pixel-7', testDir: './tests/ui', use: { ...devices['Pixel 7'], baseURL: env.uiBaseUrl } },
    { name: 'iphone-14', testDir: './tests/ui', use: { ...devices['iPhone 14'], baseURL: env.uiBaseUrl } },
  ],
});
