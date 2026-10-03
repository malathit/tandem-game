import { defineConfig } from '@playwright/test'

/** The deployed site; override with E2E_URL to aim the tests elsewhere. */
export const SITE_URL = process.env.E2E_URL ?? 'https://www.malathi.dev/tandem-game/'

export default defineConfig({
  testDir: 'e2e',
  // Each test makes real AI calls against a daily-capped Worker: run them one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: SITE_URL,
    trace: 'retain-on-failure',
  },
})
