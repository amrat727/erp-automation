import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ProductPage } from '../../pages/ProductPage';
import { bugShot as shot, visible as vis } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE for the cross-module consistency bugs (BUG-81..99) - one screenshot per bug -> screenshots/bugs/
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test --project=consistency consistency-bug-evidence
 * SAFETY: every save is blocked.
 */
const panel = (page: Page) => page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
const list = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.locator('main tbody tr:visible').first().or(page.locator('main').getByText(/no records|^No open/i).first())).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(2000);
};
const toolbar = (page: Page) => page.locator('main').getByRole('button', { name: 'Columns' }).first().locator('xpath=ancestor::div[3]');
const redFields = (scope: Locator) => scope.locator('.MuiInputBase-root.Mui-error:visible');
const banner = (page: Page) => page.locator('.MuiAlert-root:visible, [role=alert]:visible').first();

test.describe('Consistency - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(240_000);
  test.beforeEach(async ({ page }) => { await blockWrites(page, /document-templates\/preview/); });

  test('BUG-81 Supplier button "Add supplier" (Core: "Add Country")', async ({ page }) => {
    await list(page, '/suppliers');
    await shot(page, 'BUG-81-add-supplier-lowercase', vis(page.getByRole('button', { name: 'Add supplier' })));
  });
  test('BUG-82 Package button "Add New"', async ({ page }) => {
    await list(page, '/packages');
    await shot(page, 'BUG-82-package-add-new', vis(page.getByRole('button', { name: 'Add New' })));
  });
  test('BUG-83 Enquiries list built differently', async ({ page }) => {
    await list(page, '/enquiries');
    await shot(page, 'BUG-83-enquiries-list-different', vis(page.getByRole('button', { name: 'New enquiry' })), page.getByPlaceholder(/Search name, email/), page.getByText(/^No open enquiries/));
  });
  test('BUG-84 Contracts list: no Add / Audit history / column search', async ({ page }) => {
    await list(page, '/contracts');
    await shot(page, 'BUG-84-contracts-list-no-add-audit', page.locator('main thead').first(), page.getByRole('heading', { name: 'Contracts' }));
  });
  test('BUG-85 Agent list has no Audit history', async ({ page }) => {
    await list(page, '/agents');
    await shot(page, 'BUG-85-agent-package-no-audit-history', vis(page.getByRole('button', { name: 'Columns' })));
  });
  test('BUG-86 Company list: no column search, no paging', async ({ page }) => {
    await list(page, '/companies');
    await shot(page, 'BUG-86-company-list-no-search-paging', page.locator('main thead').first());
  });
  test('BUG-87 Supplier "On hold" vs Agent "On Hold"', async ({ page }) => {
    await list(page, '/agents');
    await vis(page.getByRole('columnheader', { name: /^Status/ }).getByRole('combobox')).click();
    await shot(page, 'BUG-87-on-hold-vs-on-Hold', page.getByRole('option', { name: 'On Hold' }));
  });
  test('BUG-88 Quotes filter "Inactive" (Core: "Deactive")', async ({ page }) => {
    await list(page, '/quotes');
    await vis(page.getByRole('columnheader', { name: /^Active/ }).getByRole('combobox')).click();
    await shot(page, 'BUG-88-inactive-vs-deactive', page.getByRole('option', { name: 'Inactive' }));
  });
  test('BUG-89 Extra popup "Please fix the highlighted fields." on full-page forms', async ({ page }) => {
    await page.goto('/quotes/new');
    await page.getByRole('button', { name: 'Save Quote' }).click({ timeout: 90_000 }); await page.waitForTimeout(1500);
    await shot(page, 'BUG-89-extra-fix-highlighted-fields-popup', banner(page));
  });
  test('BUG-91 Add room: different wording + numbered banner', async ({ page }) => {
    await new ProductPage(page).open(18, 'Hotel');
    await vis(page.locator('main').getByRole('button', { name: /^Add room/ })).click({ timeout: 90_000 });
    await vis(page.getByRole('button', { name: 'Create product', exact: true })).click(); await page.waitForTimeout(2000);
    await shot(page, 'BUG-91-room-wording-numbered-banner', page.getByText(/problems? to fix/).first(), page.getByText('Enter a room name.').first());
  });
  test('BUG-90 Mandatory messages worded differently (Add Agent)', async ({ page }) => {
    await page.goto('/agents/new');
    await vis(page.getByRole('button', { name: 'Create agent', exact: true })).click({ timeout: 90_000 }); await page.waitForTimeout(2500);
    await shot(page, 'BUG-90-mandatory-messages-worded-differently', page.getByText('Agent Name is required'), page.getByText('Select a default currency'));
  });
  test('BUG-92 Agent Add currency: banner only, field not marked', async ({ page }) => {
    await page.goto('/agents/6/financials');
    await vis(page.getByRole('button', { name: 'Add currency', exact: true })).click({ timeout: 90_000 });
    await panel(page).getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForTimeout(2000);
    await shot(page, 'BUG-92-agent-currency-banner-only', panel(page).getByText('Please select a currency.'), panel(page).getByPlaceholder('Select currency'));
  });
  test('BUG-93 Portal CMS: banner "Give the offer a heading." instead of field message', async ({ page }) => {
    await page.goto('/portal-cms/offers');
    await vis(page.getByRole('button', { name: 'New offer', exact: true })).click({ timeout: 90_000 });
    await panel(page).getByRole('button', { name: 'Save and publish' }).click(); await page.waitForTimeout(2000);
    await shot(page, 'BUG-93-portal-cms-banner-errors', page.getByText('Give the offer a heading.').first(), panel(page).getByPlaceholder('Heading'));
  });
  test('BUG-94 Empty Portal CMS document is sent to the server', async ({ page }) => {
    await page.goto('/portal-cms/documents');
    await vis(page.getByRole('button', { name: 'New document', exact: true })).click({ timeout: 90_000 });
    await panel(page).getByRole('button', { name: 'Save and publish' }).click(); await page.waitForTimeout(2500);
    await shot(page, 'BUG-94-empty-document-sent', panel(page).getByPlaceholder('Name').first(), page.getByText(/can't be reached/).first());
  });
  test('BUG-95 Supplier list has no Active switch (Core deactivates with a switch)', async ({ page }) => {
    await list(page, '/suppliers');
    await shot(page, 'BUG-95-supplier-agent-no-active-switch', page.locator('main tbody tr:visible td:last-child').first());
  });
});
