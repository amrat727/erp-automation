import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { bugShot as shot } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - Reservation module (BUG-109). Only runs when asked:  npm run evidence -- "BUG-109"
 * SAFETY: every save is blocked.
 */
test.describe('Reservation module - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('BUG-109 Reservation history shows raw JSON', async ({ page }) => {
    await page.goto('/reservations/3');
    await page.getByRole('tab', { name: /^History/ }).click({ timeout: 90_000 });
    const raw = page.locator('main').getByText(/"itemId"/).first();
    await expect(raw).toBeVisible({ timeout: 30_000 });
    await raw.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-109-reservation-history-raw-json', raw);
  });
});
