import { test, expect } from '@playwright/test';

// A "smoke test" = the simplest check that the app is alive.
test('ERP opens and redirects to the login page', async ({ page }) => {
  // 1. Open the website (baseURL from playwright.config.ts + '/')
  await page.goto('/');

  // 2. Expected: the app sends us to /login
  await expect(page).toHaveURL(/\/login/);

  // 3. Expected: the login form is actually VISIBLE (not just a blank page)
  //    expect() waits up to 5s automatically, so slow loading is OK.
  await expect(page.getByPlaceholder('Code')).toBeVisible();
  await expect(page.getByPlaceholder('Username')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // 4. Save a screenshot for the record
  await page.screenshot({ path: 'screenshots/login-page.png' });
});
