import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { SupplierPage } from '../../pages/SupplierPage';

/*
 * SUPPLIER BUG EVIDENCE - ONE screenshot per bug, the problem outlined in RED -> screenshots/bugs/
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test --project=supplier supplier-bug-evidence
 * SAFETY: every save is blocked, EXCEPT BUG-43 which creates two "QA Auto Supplier <STAMP> evidence" suppliers
 *         (same approval as supplier-crud.spec.ts) and ALWAYS sets both to Blocked at the end.
 */
async function shot(page: Page, file: string, ...targets: Locator[]) {
  for (const t of targets) await t.first().evaluate(el => { (el as HTMLElement).style.outline = '4px solid red'; (el as HTMLElement).style.outlineOffset = '2px'; });
  await page.waitForTimeout(500);
  const path = `screenshots/bugs/${file}.png`;
  await page.screenshot({ path });
  await test.info().attach(file, { path, contentType: 'image/png' });
}

test.describe('Supplier bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(300_000);

  test('BUG-43 Supplier: a second supplier with the same name is saved', async ({ page }) => {
    const s = new SupplierPage(page);
    const NAME = `QA Auto Supplier ${process.env.RUN_STAMP} evidence`;
    try {
      for (let i = 0; i < 2; i++) {
        await s.openAdd();
        await s.fillRequired(NAME, 'Dubai', 'AED');
        const res = page.waitForResponse(r => r.request().method() === 'POST' && /supplier/i.test(r.url()), { timeout: 60_000 });
        await s.createButton.click();
        expect((await res).ok(), `create #${i + 1} failed`).toBe(true);
        await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
      }
      await s.open();
      await s.search(NAME);
      const rows = s.rows.filter({ hasText: NAME });
      await expect(rows).toHaveCount(2);
      await shot(page, 'BUG-43-supplier-duplicate-name-saved', rows.nth(0), rows.nth(1));
    } finally {
      await s.open();
      await s.search(NAME);
      for (let i = 0; i < 4; i++) {
        const open = s.rows.filter({ hasText: NAME }).filter({ hasNot: page.locator('td:nth-child(3):text-is("Blocked")') });
        if (await open.count() === 0) break;
        await open.first().locator('td').first().click();
        await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await s.statusButton('Blocked').click();
        const save = page.getByRole('button', { name: 'Save', exact: true });
        if (await save.isEnabled()) await save.click();
        await page.waitForTimeout(3000);
        await s.open();
        await s.search(NAME);
      }
    }
  });

  test('BUG-44 Supplier: empty City says "Choose a city." instead of "City is required"', async ({ page }) => {
    await blockWrites(page);
    const s = new SupplierPage(page);
    await s.openAdd();
    await s.createButton.click();
    await expect(s.text('Choose a city.')).toBeVisible();
    await shot(page, 'BUG-44-supplier-city-message-wording', s.text('Choose a city.'), s.text('Name is required'));
  });

  test('BUG-45 Supplier: status is "On hold" in the list but "On Hold" on the supplier', async ({ page }) => {
    await blockWrites(page);
    const s = new SupplierPage(page);
    await s.open();
    await s.openSupplier('Testing season 3');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(s.statusButton('On Hold')).toBeVisible();
    await shot(page, 'BUG-45-supplier-on-hold-spelling', s.statusButton('On Hold'), s.rows.filter({ hasText: 'Testing season 3' }).locator('td:nth-child(3)'));
  });

  test('BUG-46 Supplier: a 3-character SWIFT code is sent to the server', async ({ page }) => {
    const blocked = await blockWrites(page);
    const s = new SupplierPage(page);
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: 'Add bank account' }).click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Name on the account').fill('QA Auto Holder');
    await d.getByPlaceholder('Bank name').fill('QA Auto Bank');
    await d.getByPlaceholder('IBAN, or IFSC for an Indian bank').fill('AE070331234567890123456');
    await d.getByPlaceholder('8 or 11 characters').fill('ABC');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    // (the red banner "Pilot can't be reached" appears only because this test blocks the save)
    await shot(page, 'BUG-46-supplier-swift-3-characters-sent', d.getByPlaceholder('8 or 11 characters'));
  });

  test('BUG-47 Supplier: search with spaces around the name finds nothing', async ({ page }) => {
    await blockWrites(page);
    const s = new SupplierPage(page);
    await s.open();
    await s.nameSearch.fill('  Marina Bay Hotel  ');
    await expect(s.emptyMessage).toBeVisible({ timeout: 30_000 });
    await shot(page, 'BUG-47-supplier-search-spaces-not-trimmed', s.emptyMessage, s.nameSearch);
  });
});
