import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { bugShot as shot } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - Contracts module (BUG-100..102). Only runs when asked:  npm run evidence -- "BUG-10[0-2]"
 * SAFETY: every save is blocked.
 */
test.describe('Contracts module - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => {
    await blockWrites(page);
    await page.goto('/contracts');
    await expect(page.locator('main tbody tr:visible').first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
  });

  test('BUG-101 Valid dates have no year', async ({ page }) => {
    await shot(page, 'BUG-101-contracts-valid-without-year', page.locator('main tbody tr:visible td:nth-child(5)').first(), page.locator('main tbody tr:visible td:nth-child(5)').nth(1));
  });

  test('BUG-102 Clicking a contract opens the supplier page, not the contract', async ({ page }) => {
    const name = (await page.locator('main tbody tr:visible td:nth-child(2)').first().innerText()).trim().split('\n')[0];
    await page.locator('main tbody tr:visible td:nth-child(2)').first().click();
    await expect(page.getByText('Choose a product type')).toBeVisible({ timeout: 60_000 });
    await page.evaluate(n => { const b = document.createElement('div'); b.textContent = `Clicked contract: "${n}"  ->  opened this page`; Object.assign(b.style, { position: 'fixed', top: '8px', left: '40%', background: '#fff3cd', border: '2px solid red', padding: '6px 10px', zIndex: '99999', font: '14px sans-serif' }); document.body.appendChild(b); }, name);
    await shot(page, 'BUG-102-contract-row-opens-supplier-page', page.getByText('Choose a product type'));
  });
});
