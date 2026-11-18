import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './env'; // loads .env (ERP_USERNAME etc.) and the system addresses

// ONE letters-only tag per run for test data names (workers inherit it, so it never changes mid-run)
if (!process.env.RUN_STAMP) process.env.RUN_STAMP = Date.now().toString().slice(-6).split('').map(d => 'KLMNPQRSTV'[Number(d)]).join('');

const CI = !!process.env.CI;
const wide = { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 950 } };

/*
 * Playwright settings for the whole project.
 * Every ERP module is its own "project":  npm run test:<module>   (see package.json)
 * Test kinds are picked by FILE NAME:
 *   *-ui / *-forms / consistency / *-evidence  -> read-only (saves blocked)
 *   *-crud / *-rules / *-actions / *-cleanup   -> real saves on "QA Auto ..." data, cleaned up at the end
 * Tags in test titles:  @smoke = "the screen opens and shows its main parts" (npm run test:smoke)
 */
export default defineConfig({
  testDir: './tests',          // where test files live
  outputDir: 'test-results',   // ONE folder for traces / videos / screenshots of failed tests (git-ignored)
  timeout: 120_000,            // max time per test (2 min - the server is slow)
  expect: { timeout: 20_000 }, // each expect() keeps retrying for up to 20s before failing
  retries: CI ? 1 : 0,         // CI: one retry so a slow-server hiccup is reported as "flaky", not failed
  workers: CI ? 2 : undefined, // CI: gentle on the shared test server
  reporter: CI
    ? [['html', { open: 'never' }], ['list'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,                      // tests use page.goto('/suppliers')
    screenshot: 'only-on-failure',          // save a picture when a test fails
    video: 'retain-on-failure',             // save a video when a test fails
    trace: 'retain-on-failure',             // save a step-by-step trace when a test fails
    // Slow motion for watching: set SLOWMO=800 to pause 0.8s between every action
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
  },
  projects: [
    // 1) Login tests - they log in themselves
    { name: 'login', testMatch: /0\d-.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // 2) Logs in once as sahil and saves the session (every module below starts logged in, see fixtures.ts)
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // 3) ERP modules
    { name: 'core', testDir: './tests/core', dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },
    { name: 'supplier', testDir: './tests/supplier', dependencies: ['setup'], use: wide },
    { name: 'agent', testDir: './tests/agent', dependencies: ['setup'], use: wide },
    // 4) cross-module: every module must Add / Edit / Deactivate and show errors the way Core does
    { name: 'consistency', testDir: './tests/consistency', dependencies: ['setup'], use: wide },
  ],
});
