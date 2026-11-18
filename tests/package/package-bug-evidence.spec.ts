import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { bugShot as shot, visible } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - Package module (BUG-104..106). Only runs when asked:  npm run evidence -- "BUG-10[4-6]"
 * SAFETY: every save is blocked.
 */
test.describe('Package module - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('BUG-104 Add Package: only Name gets a message', async ({ page }) => {
    await page.goto('/packages/new');
    await page.getByText('Manual', { exact: true }).first().click({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Save Package' }).click();
    await page.waitForTimeout(2000);
    await page.mouse.wheel(0, -5000); await page.waitForTimeout(600);
    const after = (label: string) => page.locator('main').getByText(label, { exact: true }).last().locator('xpath=following::input[1]');
    await shot(page, 'BUG-104-add-package-only-name-message', page.getByText('Name is required').first(), after('Currency'), after('Cities'), page.getByRole('spinbutton', { name: 'Base Price' }));
  });

  test('BUG-105 Add Bundle saves with "Save Package"', async ({ page }) => {
    await page.goto('/packages');
    await expect(page.locator('main tbody tr:visible').first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole('tab', { name: 'Bundles' }).click();
    await visible(page.getByRole('button', { name: 'New bundle' })).click();
    await expect(page.getByText('Add Bundle').first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Save Package' }).scrollIntoViewIfNeeded();
    await shot(page, 'BUG-105-add-bundle-button-save-package', page.getByRole('button', { name: 'Save Package' }));
  });

  test('BUG-106 "AI Generated" does nothing', async ({ page }) => {
    await page.goto('/packages/new');
    await page.getByText('AI Generated', { exact: true }).first().click({ timeout: 90_000 });
    await page.waitForTimeout(4000);
    await shot(page, 'BUG-106-package-ai-generated-does-nothing', page.getByText('AI Generated', { exact: true }).first());
  });
});
