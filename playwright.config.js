import { defineConfig, devices } from '@playwright/test'

// Points at the ALREADY-RUNNING dev stack (Vite on 5173, Django API on 8000).
// This config never spawns its own server — `reuseExistingServer: true`
// means Playwright only ever attaches to what's already up, and if for any
// reason the dev server were down, the webServer's own health check would
// fail fast rather than silently starting a second instance on a random
// port (vite.config.js has `strictPort: false`).
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // Journeys are intentionally NOT fully parallel: later specs (history,
  // reports, dashboard) assert on data created by earlier specs (auth,
  // upload-analysis, clean-control) against the same shared dev database.
  // Numeric filename prefixes give a deterministic run order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'true',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 10_000,
  },
})
