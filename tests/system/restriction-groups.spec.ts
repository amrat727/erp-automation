import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled } from '../../pages/FormHelpers';

/*
 * SYSTEM (menu Core > System) - Restriction Groups (access rights)
 * READ-ONLY: every save is blocked. A test fails if the app sends something it should not.
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

// ======================= RESTRICTION GROUPS =======================
test.describe('Restriction Groups', () => {
  test('TC-RG-01: Opens from Core > System > Restriction Group; list has Name, Modules, Active @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'System', 'Restriction Group']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/restrictions$/);
    for (const col of ['Name', 'Modules', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-RG-02: Has an "Audit history" button like other screens (access rights must be traceable)', async ({ page }) => {
    // BUG-35 fixed 21 Nov 2026: Audit history is there
    await openPage(page, '/restrictions', 'Restriction Groups');
    await expect(page.getByRole('button', { name: 'Audit history' })).toBeVisible({ timeout: 5_000 });
  });

  test('TC-RG-03: Add Group: empty Name shows "Name is required", nothing is sent', async ({ page }) => {
    await openPage(page, '/restrictions', 'Restriction Groups');
    await page.getByRole('button', { name: 'Add Group' }).click();
    const dlg = dialogTitled(page, 'Add Restriction Group');
    await dlg.getByRole('button', { name: 'Create & Continue' }).click();
    await expect(dlg.getByText('Name is required')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-RG-04: Users still need a Restriction Group although the list is EMPTY', async ({ page }) => {
    await openPage(page, '/restrictions', 'Restriction Groups');
    const empty = await page.getByText('There are no records in Restriction Group').isVisible();
    test.skip(!empty, 'groups exist');
    // business rule check: "Restriction Group*" is REQUIRED on Add User -> with no groups no user can be created
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add User' }).click({ timeout: 60_000 });
    const dlg = dialogTitled(page, 'Add User');
    await dlg.getByText(/^Restriction Group\s*\*$/).locator('xpath=following::input[1]').click();
    await page.waitForTimeout(2000);
    const options = await page.getByRole('option').allInnerTexts();
    test.info().annotations.push({ type: 'groups offered on Add User', description: options.join(', ') || '(none)' });
    expect(options.filter(o => !/no options/i.test(o)).length, 'Add User requires a Restriction Group but none can be picked').toBeGreaterThan(0);
  });
});
