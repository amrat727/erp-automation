import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage, ContractsListPage } from '../../pages/ContractPage';

/*
 * CONTRACT BUG EVIDENCE - ONE screenshot per bug, the problem outlined in RED -> screenshots/bugs/
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test --project=supplier contract-bug-evidence
 * SAFETY: every save is blocked (the red "Pilot can't be reached" banner only appears because of that).
 */
async function shot(page: Page, file: string, ...targets: Locator[]) {
  for (const t of targets) await t.first().evaluate(el => { (el as HTMLElement).style.outline = '4px solid red'; (el as HTMLElement).style.outlineOffset = '2px'; });
  await page.waitForTimeout(500);
  const path = `screenshots/bugs/${file}.png`;
  await page.screenshot({ path });
  await test.info().attach(file, { path, contentType: 'image/png' });
}

test.describe('Contract bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(240_000);

  test('BUG-48 Contract: saved without the required Currency', async ({ page }) => {
    const blocked = await blockWrites(page);
    const c = new ContractPage(page);
    await c.openAddContract(18, 'Hotel');
    await c.name.fill('QA Auto Contract no currency');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.saveButton.click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    await shot(page, 'BUG-48-contract-saved-without-currency', c.currency.locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'), c.saveButton);
  });

  test('BUG-49 Contract: a negative Priority (-5) is accepted', async ({ page }) => {
    const blocked = await blockWrites(page);
    const c = new ContractPage(page);
    await c.openAddContract(18, 'Hotel');
    await c.name.fill('QA Auto Contract priority');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.priority.fill('-5');
    await c.priority.press('Tab');
    await c.saveButton.click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    await shot(page, 'BUG-49-contract-negative-priority-accepted', c.priority);
  });

  test('BUG-50 Contracts list: "Valid" has no year, so a 1-year contract looks like it ends before it starts', async ({ page }) => {
    await blockWrites(page);
    const l = new ContractsListPage(page);
    await l.open();
    const row = l.rows.filter({ hasText: 'Connaught Demo 2026-27 BAR' });
    await shot(page, 'BUG-50-contracts-list-valid-without-year', row.locator('td:nth-child(5)'), row.locator('td:nth-child(2)'));
  });
});
