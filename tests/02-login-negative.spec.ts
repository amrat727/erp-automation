import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/*
 * LOGIN - UI, validation, negative, edge and security cases.
 * These do NOT need a valid account.
 * NOTE: we use fake usernames on purpose, so we never lock the real test account.
 */

let login: LoginPage;
let loginRequests: number; // counts how many times the app called the login API

test.beforeEach(async ({ page }) => {
  loginRequests = 0;
  page.on('request', r => { if (r.url().includes('/auth/login')) loginRequests++; });
  login = new LoginPage(page);
  await login.open();
});

// ---------------- UI ----------------
test.describe('UI', () => {
  test('TC-LOGIN-01: All login page elements are visible @smoke', async ({ page }) => {
    await expect(page).toHaveTitle('Pilot');
    await expect(page.getByText('Company code')).toBeVisible();
    await expect(login.companyCode).toBeVisible();
    await expect(login.username).toBeVisible();
    await expect(login.password).toBeVisible();
    await expect(login.rememberMe).toBeAttached();
    await expect(page.getByText('Remember me')).toBeVisible();
    await expect(login.forgotPassword).toBeVisible();
    await expect(login.signInButton).toBeEnabled();
  });

  test('TC-LOGIN-02: Username & Password are mandatory, Company code is optional', async () => {
    await expect(login.username).toHaveAttribute('required', '');
    await expect(login.password).toHaveAttribute('required', '');
    await expect(login.companyCode).not.toHaveAttribute('required', '');
  });

  test('TC-LOGIN-03: Password is masked by default', async () => {
    await login.password.fill('Secret123');
    await expect(login.password).toHaveAttribute('type', 'password');
  });

  test('TC-LOGIN-04: Eye icon shows and hides the password', async () => {
    await login.password.fill('Secret123');
    await login.eyeIcon.click();
    await expect(login.password).toHaveAttribute('type', 'text');
    await expect(login.password).toHaveValue('Secret123'); // value not lost
    await login.eyeIcon.click();
    await expect(login.password).toHaveAttribute('type', 'password');
  });

  test('TC-LOGIN-05: Remember me toggle can be switched on and off', async () => {
    await expect(login.rememberMe).not.toBeChecked();
    await login.rememberMeLabel.click();          // click it like a user would
    await expect(login.rememberMe).toBeChecked();
    await login.rememberMeLabel.click();
    await expect(login.rememberMe).not.toBeChecked();
  });

  test('TC-LOGIN-06: "Forgot password?" opens the forgot-password page', async ({ page }) => {
    await login.forgotPassword.click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('TC-LOGIN-07: Tab key moves Code -> Username -> Password', async ({ page }) => {
    await login.companyCode.focus();
    await page.keyboard.press('Tab');
    await expect(login.username).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(login.password).toBeFocused();
  });

  test('TC-LOGIN-08: Pressing Enter submits the form', async () => {
    await login.fill('TEST', 'fake_user_qa', 'Wrong@123');
    await login.password.press('Enter');
    await expect(login.errorInvalid).toBeVisible();
    expect(loginRequests).toBe(1);
  });
});

// ---------------- Field validation ----------------
test.describe('Validation', () => {
  test('TC-LOGIN-09: All fields empty -> not submitted, Username flagged', async ({ page }) => {
    await login.signInButton.click();
    expect(await login.isFieldValid(login.username)).toBe(false);
    await expect(page).toHaveURL(/\/login/);
    expect(loginRequests).toBe(0); // nothing sent to the server
  });

  test('TC-LOGIN-10: Only Username filled -> Password flagged', async () => {
    await login.fill(undefined, 'fake_user_qa', undefined);
    await login.signInButton.click();
    expect(await login.isFieldValid(login.password)).toBe(false);
    expect(loginRequests).toBe(0);
  });

  test('TC-LOGIN-11: Only Password filled -> Username flagged', async () => {
    await login.fill(undefined, undefined, 'Wrong@123');
    await login.signInButton.click();
    expect(await login.isFieldValid(login.username)).toBe(false);
    expect(loginRequests).toBe(0);
  });

  test('TC-LOGIN-12: Spaces-only Username/Password is rejected', async ({ page }) => {
    await login.fill('', '   ', '   ');
    await login.signInButton.click();
    await page.waitForTimeout(2000);
    // Either blocked in the browser OR rejected by server - but never logged in
    await expect(page).toHaveURL(/\/login/);
    if (loginRequests > 0) await expect(login.errorInvalid).toBeVisible();
  });
});

// ---------------- Wrong credentials ----------------
test.describe('Negative', () => {
  test('TC-LOGIN-13: Non-existing username -> "Invalid credentials"', async ({ page }) => {
    const res = await login.login('TEST', 'fake_user_qa', 'Wrong@123');
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-14: Wrong company code -> "Invalid credentials"', async () => {
    const res = await login.login('NO_SUCH_COMPANY_999', 'fake_user_qa', 'Wrong@123');
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
  });

  test('TC-LOGIN-15: Error message is generic (does not reveal which field is wrong)', async ({ page }) => {
    await login.login('TEST', 'fake_user_qa', 'Wrong@123');
    await expect(login.errorInvalid).toBeVisible();
    await expect(page.getByText(/user (not found|does not exist)|wrong password|incorrect password/i)).toHaveCount(0);
  });

  test('TC-LOGIN-16: Form values are kept after a failed login', async () => {
    await login.login('TEST', 'fake_user_qa', 'Wrong@123');
    await expect(login.errorInvalid).toBeVisible();
    await expect(login.username).toHaveValue('fake_user_qa');
    await expect(login.companyCode).toHaveValue('TEST');
  });
});

// ---------------- Edge cases ----------------
test.describe('Edge cases', () => {
  test('TC-LOGIN-17: Very long input (5000 chars) is handled without server error', async () => {
    const long = 'a'.repeat(5000);
    const res = await login.login(long, long, long);
    expect(res.status(), 'server should not crash (5xx)').toBeLessThan(500);
    await expect(login.errorInvalid).toBeVisible();
  });

  test('TC-LOGIN-18: Special characters & unicode are handled', async () => {
    const res = await login.login('ÄÖÜ-测试', 'user!#$%^&*()_+ é 😀', 'p@$$w0rd™😀');
    expect(res.status()).toBeLessThan(500);
    await expect(login.errorInvalid).toBeVisible();
  });

  test('TC-LOGIN-19: Multiple quick clicks on Sign in do not crash the page', async ({ page }) => {
    await login.fill('TEST', 'fake_user_qa', 'Wrong@123');
    await login.signInButton.click({ clickCount: 3 });
    await expect(login.errorInvalid).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    test.info().annotations.push({ type: 'info', description: `Login requests sent for triple click: ${loginRequests}` });
  });
});

// ---------------- Security ----------------
test.describe('Security', () => {
  test('TC-LOGIN-20: SQL injection is rejected safely', async ({ page }) => {
    const res = await login.login("' OR '1'='1", "admin' --", "' OR '1'='1");
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-LOGIN-21: XSS script in inputs is not executed', async ({ page }) => {
    let alertShown = false;
    page.on('dialog', async d => { alertShown = true; await d.dismiss(); });
    const xss = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    await login.login(xss, xss, xss);
    await expect(login.errorInvalid).toBeVisible();
    expect(alertShown, 'an alert popup means XSS executed').toBe(false);
  });

  test('TC-LOGIN-22: Password never appears in the page URL', async ({ page }) => {
    await login.login('TEST', 'fake_user_qa', 'SecretPass@999');
    await expect(login.errorInvalid).toBeVisible();
    expect(page.url()).not.toContain('SecretPass');
    expect(page.url()).not.toContain('password=');
  });

  test('TC-LOGIN-23: Login is sent as POST over HTTPS', async () => {
    const res = await login.login('TEST', 'fake_user_qa', 'Wrong@123');
    expect(res.request().method()).toBe('POST');
    expect(res.url().startsWith('https://')).toBe(true);
  });

  test('TC-LOGIN-24: Protected pages redirect to login when not signed in', async ({ page }) => {
    for (const path of ['/', '/dashboard', '/home']) {
      await page.goto(path);
      await expect(page, `opening ${path} without login`).toHaveURL(/\/login/);
    }
  });
});
