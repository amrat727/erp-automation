import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { SupplierPage } from '../../pages/SupplierPage';

/*
 * SUPPLIER - gap coverage (READ-ONLY: every save is blocked, real suppliers are never changed).
 * Run:  npx playwright test --project=supplier supplier-gaps
 * Real data used: "Testing season 3" (ABD-001, On hold) - services Hotel (2 products), Excursion (1), Private transfer.
 */
let blocked: string[];
let s: SupplierPage;
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); s = new SupplierPage(page); });

const SUPPLIER = 'Testing season 3';
const visible = (page: import('@playwright/test').Page, t: string | RegExp) =>
  typeof t === 'string' ? page.locator(`main :text-is("${t}"):visible`).first() : page.locator('main :visible').getByText(t).first();

test.describe('List: Columns button', () => {
  test('TC-SUP-60: Columns menu offers Name / Code / Status, all ticked, and "Show all"', async ({ page }) => {
    await s.open();
    await s.columnsButton.click();
    for (const c of ['Name', 'Code', 'Status']) {
      const item = page.getByRole('menuitem', { name: c });
      await expect(item).toBeVisible();
      await expect(item.getByRole('checkbox')).toBeChecked();
    }
    await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
  });

  test('TC-SUP-61: Un-ticking "Status" hides the Status column; "Show all" brings it back', async ({ page }) => {
    await s.open();
    const header = page.getByRole('columnheader', { name: /Status/ });
    await expect(header).toBeVisible();
    await s.columnsButton.click();
    await page.getByRole('menuitem', { name: 'Status' }).click();
    await expect(header).toBeHidden();
    await page.getByRole('button', { name: 'Show all' }).click();
    await page.keyboard.press('Escape');   // the menu stays open and hides the table from the accessibility tree
    await expect(header).toBeVisible();
    expect(blocked).toEqual([]);
  });
});

test.describe('Existing supplier: Products, addresses, documents, content', () => {
  test.beforeEach(async () => { await s.open(); await s.openSupplier(SUPPLIER); });

  test('TC-SUP-62: Products tab lists every offered service and has "Edit products offered"', async ({ page }) => {
    await s.tab('Products').click();
    await expect(page.getByRole('button', { name: 'Edit products offered' })).toBeVisible({ timeout: 30_000 });
    for (const p of ['Hotel', 'Excursion', 'Private transfer']) await expect(visible(page, p)).toBeVisible();
  });

  test('TC-SUP-63: Edit mode - a service that already has products cannot be removed (hint explains why)', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(page.locator('main [aria-label*="Delete or deactivate them on the Products tab"]:visible').first()).toBeAttached({ timeout: 30_000 });
    for (const svc of ['Hotel', 'Excursion']) {
      await expect(page.locator(`main [aria-label*="before removing ${svc}"]`).first()).toBeAttached();
    }
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-64: Overview - Services offered shows the service chips with product counts', async ({ page }) => {
    await expect(visible(page, /Hotel\s*·\s*\d+/)).toBeVisible({ timeout: 30_000 });
    await expect(visible(page, /Excursion\s*·\s*\d+/)).toBeVisible();
  });

  test('TC-SUP-65: Contacts tab - Primary and Correspondence address sections, read-only until Edit', async ({ page }) => {
    await s.tab('Contacts').click();
    await expect(visible(page, 'Primary address')).toBeVisible({ timeout: 30_000 });
    await expect(visible(page, 'Correspondence address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible();
    for (const ph of ['Street, building', 'Postal code', 'Phone', 'Email']) {
      await expect(page.locator(`main input[placeholder="${ph}"]:visible`).first()).toBeDisabled();
    }
  });

  test('TC-SUP-66: Overview shows Documents "x of y uploaded" and the Supplier portal login state', async ({ page }) => {
    await expect(visible(page, /\d+ of \d+ uploaded/)).toBeVisible({ timeout: 30_000 });
    await expect(visible(page, 'Supplier portal')).toBeVisible();
    await expect(visible(page, /No login|Login/)).toBeVisible();
  });

  test('TC-SUP-67: Content tab - editor toolbar (Bold, Italic, Underline, lists, alignment)', async ({ page }) => {
    await s.tab('Content').click();
    await expect(page.locator('main :text("All changes saved"):visible').first()).toBeVisible({ timeout: 30_000 });
    for (const b of ['Bold', 'Italic', 'Underline', 'Align left', 'Align centre', 'Align right', 'Bulleted list', 'Numbered list'])
      await expect(page.getByRole('button', { name: b }).first()).toBeVisible();
  });

  test('TC-SUP-68: Content tab - all 8 content sections are listed', async ({ page }) => {
    await s.tab('Content').click();
    await expect(page.locator('main :text("All changes saved"):visible').first()).toBeVisible({ timeout: 30_000 });
    for (const sec of ['Overview', 'Description', 'Images', 'Property and rooms', 'Dining and recreation', 'Location and attractions', 'Policies and instructions', 'Fees and renovation'])
      await expect(page.locator(`main :text-is("${sec}"):visible`).first()).toBeVisible();
  });
});
