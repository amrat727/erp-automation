import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import { LoginPage } from '../pages/LoginPage';

/*
 * Runs ONCE before the Core tests: logs in as sahil and saves the login
 * session to a file. Every Core test then starts already logged in,
 * which saves ~20 seconds per test on the slow server.
 */
export const SESSION_FILE = 'playwright/.auth/session.json';

setup('log in as sahil and save session', async ({ page }) => {
  setup.setTimeout(180_000);
  const login = new LoginPage(page);
  await login.open();
  const res = await login.login(process.env.ERP_COMPANY_CODE!, process.env.ERP_USERNAME!, process.env.ERP_PASSWORD!);
  expect(res.status(), 'login for setup must succeed').toBe(200);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });

  // This app keeps the login token in sessionStorage -> save it to a file
  const session = await page.evaluate(() => JSON.stringify(sessionStorage));
  fs.mkdirSync('playwright/.auth', { recursive: true });
  fs.writeFileSync(SESSION_FILE, session);
});
