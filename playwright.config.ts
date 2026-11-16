import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config'; // loads ERP_USERNAME etc. from the .env file

// ONE letters-only tag per run for test data names (workers inherit it, so it never changes mid-run)
if (!process.env.RUN_STAMP) process.env.RUN_STAMP = Date.now().toString().slice(-6).split('').map(d => 'KLMNPQRSTV'[Number(d)]).join('');

// Playwright settings for the whole project
export default defineConfig({
  testDir: './tests',          // where test files live
  timeout: 120_000,            // max time per test (2 min - free server is slow)
  expect: { timeout: 20_000 }, // each expect() keeps retrying for up to 20s before failing
  reporter: [['html', { open: 'never' }], ['list']], // nice HTML report + console output
  use: {
    baseURL: 'https://erp.nexgenpilot.com', // so tests can use page.goto('/')
    screenshot: 'only-on-failure',          // save a picture when a test fails
    video: 'retain-on-failure',             // save a video when a test fails
    trace: 'retain-on-failure',             // save a step-by-step trace when a test fails
    // Slow motion for watching: set SLOWMO=800 to pause 0.8s between every action
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
  },
  projects: [
    // 1) Login tests - they log in themselves
    { name: 'login', testMatch: /0\d-.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    // 2) Logs in once as sahil and saves the session
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // 3) Core module tests - start already logged in (see fixtures.ts)
    { name: 'core', testDir: './tests/core', dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },
    // 4) Supplier module tests - also start logged in
    { name: 'supplier', testDir: './tests/supplier', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 950 } } },
    // 5) Agent module tests - also start logged in
    { name: 'agent', testDir: './tests/agent', dependencies: ['setup'], use: { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 950 } } },
  ],
});
