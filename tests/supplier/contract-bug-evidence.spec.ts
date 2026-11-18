import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage, ContractsListPage } from '../../pages/ContractPage';
import { bugShot } from '../../pages/FormHelpers';

/*
 * CONTRACT BUG EVIDENCE - ONE screenshot per bug, the problem outlined in RED -> screenshots/bugs/
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test --project=supplier contract-bug-evidence
 * SAFETY: every save is blocked (the red "Pilot can't be reached" banner only appears because of that).
 */
const shot = bugShot;   // shared helper: pages/FormHelpers.ts

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

  // ----- business rules confirmed by the product owner (supplier-rules.spec.ts) - screenshots of the saved results -----
  const openBlockedSupplier = async (page: Page, tab: string) => {
    await page.goto('/suppliers');
    await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('QA Auto Supplier');
    const row = page.locator('main tbody tr:visible', { hasText: 'Blocked' }).first();
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.locator('td').first().click();
    await expect(page.getByRole('tab', { name: 'Overview' }).first()).toBeVisible({ timeout: 60_000 });
    await page.goto(page.url().replace(/\/overview.*/, `/${tab}`));
    await page.waitForTimeout(4000);
  };

  test('BUG-51 Supplier: a Blocked supplier can still be edited and saved', async ({ page }) => {
    await blockWrites(page);
    await openBlockedSupplier(page, 'overview');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const f = page.locator('main input[type=text]:visible:not([disabled]):not([placeholder="Search"])').first();
    await f.fill((await f.inputValue()) + ' changed');
    await expect(page.getByRole('button', { name: 'Save', exact: true }).last()).toBeEnabled();
    await shot(page, 'BUG-51-blocked-supplier-can-be-edited', page.locator('main').getByText('Blocked').first(), page.getByRole('button', { name: 'Save', exact: true }).last(), f);
  });

  test('BUG-52 Supplier: a contact was added to a Blocked supplier', async ({ page }) => {
    await blockWrites(page);
    await openBlockedSupplier(page, 'contacts');
    const added = page.locator('main :visible').getByText(/QA Auto Contact \w+ blocked/).first();
    await expect(added).toBeVisible({ timeout: 30_000 });
    await shot(page, 'BUG-52-contact-added-to-blocked-supplier', added, page.locator('main').getByText('Blocked').first());
  });

  test('BUG-53 Supplier: a currency can be added to a Blocked supplier', async ({ page }) => {
    await blockWrites(page);
    await openBlockedSupplier(page, 'financials');
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Select a currency').fill('USD');
    await page.getByRole('option', { name: /USD/ }).first().click();
    await shot(page, 'BUG-53-currency-can-be-added-to-blocked-supplier', d, page.locator('main').getByText('Blocked').first());
  });

  test('BUG-54 Contract: two contracts with the same priority are both saved', async ({ page }) => {
    await blockWrites(page);
    const c = new ContractPage(page);
    await c.openProduct(18, 'Hotel', 'Contract');
    const b = c.rows.filter({ hasText: /prio B/ }).first();
    const stamp = ((await b.locator('td').first().innerText()).match(/QA Auto Contract (\w+) prio B/) ?? [])[1];
    const a = c.rows.filter({ hasText: `${stamp} prio A` }).first();
    await expect(b).toBeVisible();
    await shot(page, 'BUG-54-contract-same-priority-saved', a.locator('td').nth(3), b.locator('td').nth(3), a.locator('td').first(), b.locator('td').first());
  });

  test('BUG-55 Contract: contract keeps "Approved" after its currency was removed from the supplier', async ({ page }) => {
    await blockWrites(page);
    const c = new ContractPage(page);
    await c.openProduct(18, 'Hotel', 'Contract');
    const row = c.rows.filter({ hasText: / USD/ }).last();
    await expect(row).toContainText('Approved');
    await shot(page, 'BUG-55-contract-stays-approved-after-currency-removed', row.locator('td').nth(4), row.locator('td').first());
  });

  test('BUG-50 Contracts list: "Valid" has no year, so a 1-year contract looks like it ends before it starts', async ({ page }) => {
    await blockWrites(page);
    const l = new ContractsListPage(page);
    await l.open();
    const row = l.rows.filter({ hasText: 'Connaught Demo 2026-27 BAR' });
    await shot(page, 'BUG-50-contracts-list-valid-without-year', row.locator('td:nth-child(5)'), row.locator('td:nth-child(2)'));
  });
});
