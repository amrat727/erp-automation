import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { bugShot as shot } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - Quotes module (BUG-107, 108). Only runs when asked:  npm run evidence -- "BUG-10[78]"
 * SAFETY: every save is blocked.
 */
test.describe('Quotes module - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('BUG-107 Add Quote offers Blocked agents', async ({ page }) => {
    await page.goto('/quotes/new');
    await expect(page.getByRole('button', { name: 'Save Quote' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('combobox', { name: 'Agent', exact: true }).click();
    await page.keyboard.type('QA Auto Agent', { delay: 30 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const b = document.createElement('div'); b.textContent = 'All "QA Auto Agent" agents are Blocked in Agent > Status'; Object.assign(b.style, { position: 'fixed', top: '8px', left: '40%', background: '#fff3cd', border: '2px solid red', padding: '6px 10px', zIndex: '99999', font: '14px sans-serif' }); document.body.appendChild(b); });
    const opts = page.getByRole('option');
    await shot(page, 'BUG-107-add-quote-offers-blocked-agents', opts.nth(0), opts.nth(1), opts.nth(2));
  });

  test('BUG-108 Quote history shows an internal number', async ({ page }) => {
    await page.goto('/quotes/1');
    await page.getByRole('tab', { name: /^History/ }).click({ timeout: 90_000 });
    const bad = page.locator('main').getByText(/-9223372036854\d+/).first();
    await expect(bad).toBeVisible({ timeout: 30_000 });
    await bad.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-108-quote-history-internal-number', bad);
  });
});
