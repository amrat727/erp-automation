import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';

/*
 * LOGIN - positive, session and logout cases with the REAL test account (.env).
 * Only 2 tests use a wrong password for this user, to stay far away from any lockout.
 */
const CODE = process.env.ERP_COMPANY_CODE!;
const USER = process.env.ERP_USERNAME!;
const PASS = process.env.ERP_PASSWORD!;

let login: LoginPage;
let dash: DashboardPage;

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000); // free server can be slow
  login = new LoginPage(page);
  dash = new DashboardPage(page);
  await login.open();
});

// ---------------- Successful login ----------------
test.describe('Valid login', () => {
  test('TC-LOGIN-25: Valid credentials -> dashboard opens', async ({ page }) => {
    const res = await login.login(CODE, USER, PASS);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.userName).toBe(USER);
    expect(body.companyName).toBe('Sandbox');

    await dash.waitUntilLoaded();
    await expect(dash.greeting).toContainText('Sahil');
    expect(await dash.hasToken()).toBe(true);
    await expect(login.errorInvalid).toHaveCount(0);
  });

  test('TC-LOGIN-26: Valid login using Enter key', async () => {
    await login.fill(CODE, USER, PASS);
    await login.password.press('Enter');
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-27: Profile shows the logged-in user details', async ({ page }) => {
    await login.login(CODE, USER, PASS);
    await dash.waitUntilLoaded();
    await dash.openProfile();
    await expect(page.getByText('Sahil Chauhan').first()).toBeVisible();
    await expect(page.getByText('Company Admin')).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(dash.signOutButton).toBeVisible();
  });
});

// ---------------- Case & whitespace edge cases ----------------
test.describe('Case & spaces', () => {
  test('TC-LOGIN-28: Company code is case-insensitive ("SB")', async () => {
    const res = await login.login(CODE.toUpperCase(), USER, PASS);
    expect(res.status()).toBe(200);
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-29: Username is case-insensitive ("SAHIL")', async () => {
    const res = await login.login(CODE, USER.toUpperCase(), PASS);
    expect(res.status()).toBe(200);
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-30: Password IS case-sensitive (wrong case is rejected)', async ({ page }) => {
    const res = await login.login(CODE, USER, PASS.toLowerCase());
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-31: Spaces around username/code are trimmed', async () => {
    test.fail(true, 'BUG FOUND: "  sahil  " / "  sb  " are not trimmed -> 401 Invalid credentials');
    const res = await login.login(`  ${CODE}  `, `  ${USER}  `, PASS);
    expect(res.status()).toBe(200);
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-32: Extra space in password is NOT accepted', async () => {
    const res = await login.login(CODE, USER, `${PASS} `);
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
  });
});

// ---------------- Session ----------------
test.describe('Session', () => {
  test.beforeEach(async () => {
    await login.login(CODE, USER, PASS);
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-33: Refreshing the page keeps the user logged in', async ({ page }) => {
    await page.reload();
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-34: Session is per tab - a new tab asks to log in again', async ({ context }) => {
    const tab2 = await context.newPage();
    await tab2.goto('/dashboard');
    await expect(tab2).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test('TC-LOGIN-35: Logged-in user opening /login is sent to the dashboard', async ({ page }) => {
    test.fail(true, 'KNOWN ISSUE: app shows the login form instead of redirecting to dashboard');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

// ---------------- Remember me ----------------
test.describe('Remember me', () => {
  test('TC-LOGIN-36: Remember me ON -> company and username remembered after sign out', async ({ page }) => {
    await login.fill(CODE, USER, PASS);
    await login.rememberMeLabel.click();
    await expect(login.rememberMe).toBeChecked();
    await login.signInButton.click();
    await dash.waitUntilLoaded();

    await dash.signOut();
    await expect(page).toHaveURL(/\/login/);

    // Expected: company shown as a "Sandbox" chip, username pre-filled, toggle still ON, password empty
    const companyChip = page.getByText('Sandbox', { exact: true });
    await expect(companyChip).toBeVisible();
    await expect(login.companyCode).toHaveCount(0);   // Code box replaced by the chip
    await expect(login.username).toHaveValue(USER);
    await expect(login.rememberMe).toBeChecked();
    await expect(login.password).toHaveValue('');     // password must never be remembered

    // Clicking the X on the chip brings back the empty Code box
    await companyChip.locator('xpath=..').getByRole('button').click();
    await expect(login.companyCode).toBeVisible();
    await expect(login.companyCode).toHaveValue('');
  });

  test('TC-LOGIN-36b: Remembered user can log in with just the password', async () => {
    // set up "remembered" state
    await login.fill(CODE, USER, PASS);
    await login.rememberMeLabel.click();
    await login.signInButton.click();
    await dash.waitUntilLoaded();
    await dash.signOut();

    await login.password.fill(PASS);
    await login.signInButton.click();
    await dash.waitUntilLoaded();
  });
});

// ---------------- Logout ----------------
test.describe('Sign out', () => {
  test.beforeEach(async () => {
    await login.login(CODE, USER, PASS);
    await dash.waitUntilLoaded();
  });

  test('TC-LOGIN-37: Sign out returns to login and clears the token', async ({ page }) => {
    await dash.signOut();
    await expect(page).toHaveURL(/\/login/);
    await expect(login.signInButton).toBeVisible();
    expect(await dash.hasToken()).toBe(false);
  });

  test('TC-LOGIN-38: Browser Back after sign out does not re-open the app', async ({ page }) => {
    await dash.signOut();
    await expect(page).toHaveURL(/\/login/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
    await expect(dash.greeting).toHaveCount(0);
  });

  test('TC-LOGIN-39: Opening /dashboard directly after sign out goes to login', async ({ page }) => {
    await dash.signOut();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------- Lockout (manual / throwaway account only) ----------------
test('TC-LOGIN-40: Account locks after N wrong passwords', async () => {
  test.skip(true, 'Skipped on purpose: would lock the real test account. Run only with a throwaway user.');
});
