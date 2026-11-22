import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled, inputAfter } from '../../pages/FormHelpers';

/*
 * SYSTEM (menu Core > System) - business rules for Users (product owner, 13 Nov 2026): standard password rules; nobody may "report to" themself
 * READ-ONLY: every save is blocked. A test fails if the app sends something it should not.
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

// ======================= USERS =======================
test.describe('Business rules - Users', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('button', { name: 'Add User' }).click();
    const dlg = dialogTitled(page, 'Add User');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  // Standard rule: 8+ characters with a capital, a small letter, a digit and a symbol
  for (const [weak, why] of [['abc', 'too short'], ['abcdefgh', 'letters only'], ['12345678', 'digits only'], ['Password1', 'no symbol']]) {
    test(`TC-BR-USR-01: Weak password "${weak}" (${why}) is rejected with a password message`, async ({ page }) => {
      const dlg = await openAdd(page);
      await dlg.locator('input[type=password]').fill(weak);
      await dlg.getByRole('button', { name: 'Save' }).click();
      await expect(dlg.getByText(/password (must|should)|at least \d+|uppercase|special character|too weak/i).first(),
        `weak password "${weak}" gives no password-rule message`).toBeVisible();
      expect(blocked).toEqual([]);
    });
  }

  test('TC-BR-USR-02: Strong password "Test@12345" shows no password-rule message', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.locator('input[type=password]').fill('Test@12345');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText(/password (must|should)|at least \d+|uppercase|special character|too weak/i)).toHaveCount(0);
    expect(blocked).toEqual([]);
  });

  test('TC-BR-USR-03: A user cannot be picked as their OWN "Reports To"', async ({ page }) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('cell', { name: 'sahil', exact: true }).click();
    // v1.0.2: full-page user record; "Reports To" is on the Security tab and unlocks with Edit
    await expect(page.getByRole('tab', { name: 'Security' })).toBeVisible({ timeout: 30_000 });
    const nameBox = page.getByRole('textbox', { name: 'Name' });                   // Overview tab, read-only
    await expect(nameBox).not.toHaveValue('');
    const fullName = await nameBox.inputValue();                                   // "Sahil Chauhan"
    await page.getByRole('tab', { name: 'Security' }).click();
    await page.locator('main').getByRole('button', { name: 'Edit', exact: true }).click();
    const reportsTo = page.locator('main').getByRole('combobox', { name: 'Reports To' })
      .or(inputAfter(page.locator('main'), 'Reports To')).first();
    await expect(reportsTo).toBeEnabled();
    await reportsTo.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('option', { name: fullName, exact: true }),
      `"${fullName}" is offered as their own manager`).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('main').getByRole('button', { name: 'Cancel', exact: true }).click();   // never save
    expect(blocked).toEqual([]);
  });
});
