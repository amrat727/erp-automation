import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { bugShot as shot, visible } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - CRM / Insights / Portal CMS (BUG-110, 111). Only runs when asked:  npm run evidence -- "BUG-11[01]"
 * SAFETY: every save is blocked.
 */
test.describe('CRM - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(180_000);

  test('BUG-110 Enquiry accepts the e-mail "abc"', async ({ page }) => {
    const blocked = await blockWrites(page);
    await page.goto('/enquiries');
    await visible(page.getByRole('button', { name: 'New enquiry' })).click({ timeout: 90_000 });
    const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
    await d.getByPlaceholder('Full name').fill('QA Auto Enquiry');
    await d.locator('input[type=email]').fill('abc');
    await d.getByRole('button', { name: 'Create enquiry' }).click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.evaluate(u => { const b = document.createElement('div'); b.textContent = 'Sent to the server: ' + u; Object.assign(b.style, { position: 'fixed', bottom: '40px', left: '30%', background: '#fff3cd', border: '2px solid red', padding: '6px 10px', zIndex: '99999', font: '13px sans-serif' }); document.body.appendChild(b); }, blocked[0].slice(0, 80) + ' (e-mail "abc")');
    await shot(page, 'BUG-110-enquiry-email-abc-accepted', d.locator('input[type=email]'));
  });

  test('BUG-111 Dashboard counts Blocked agents as active', async ({ page }) => {
    await blockWrites(page);
    await page.goto('/dashboard');
    const card = page.locator('main').getByText('Agent network').locator('xpath=ancestor::*[.//*[contains(.,"Blocked")]][1]');
    await expect(card).toBeVisible({ timeout: 90_000 });
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-111-dashboard-blocked-agents-counted-active', page.locator('main').getByText(/\d+ active · \d+ B2B/).first(), card.getByText('Blocked', { exact: true }).first());
  });
});
