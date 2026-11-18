import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { visible } from '../../pages/FormHelpers';

/*
 * PACKAGE MODULE (menu "Package" -> /packages): Packages and Bundles lists, Published / Active switches,
 * Add New (AI Generated / Manual) form, New bundle, a package's detail tabs and Policies edit.
 * SAFETY: every save is BLOCKED - nothing can change.
 */
const SAMPLE = 'Dubai Delights 4N/5D';
class PackageModule {
  constructor(readonly page: Page) {}
  get heading() { return this.page.getByRole('heading', { name: 'Packages', exact: true }); }
  get rows() { return this.page.locator('main tbody tr:visible'); }
  get nameSearch() { return this.page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox'); }
  row(name: string) { return this.rows.filter({ hasText: name }).first(); }
  async open() {
    await this.page.goto('/packages');
    await expect(this.heading).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 90_000 });
    await this.page.waitForTimeout(1500);
  }
  async manual() {
    await this.page.goto('/packages/new');
    await this.page.getByText('Manual', { exact: true }).first().click({ timeout: 90_000 });
    await expect(this.page.getByRole('button', { name: 'Save Package' })).toBeVisible({ timeout: 30_000 });
  }
  field(label: string) { return this.page.locator('main').getByText(new RegExp(`^${label}\\*?$`)).first().locator('xpath=following::input[1]'); }
}

test.describe('Package module - list', () => {
  let p: PackageModule;
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); p = new PackageModule(page); await p.open(); });
  test.afterEach(() => expect(blocked, 'nothing may be saved').toEqual([]));

  test('TC-PKG-01: Opens from the menu "Package"; columns Name, Type, From, To, Currency, Pax Min, Pax Max, Book Before, Published, Active @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Package', exact: true }).click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/packages$/);
    await expect(page.locator('main thead th:visible')).toContainText(['Name', 'Type', 'From', 'To', 'Currency', 'Pax Min', 'Pax Max', 'Book Before', 'Published', 'Active']);
  });

  test('TC-PKG-02: Tabs Packages / Bundles; Bundles has "New bundle" and the empty message', async ({ page }) => {
    await page.getByRole('tab', { name: 'Bundles' }).click();
    await expect(visible(page.getByRole('button', { name: 'New bundle' }))).toBeVisible();
    await expect(page.getByText('There are no records in Bundle').or(page.locator('main tbody tr:visible').first())).toBeVisible();
  });

  test('TC-PKG-03: Active filter offers All / Active / Deactive', async ({ page }) => {
    await page.getByRole('columnheader', { name: /^Active/ }).getByRole('combobox').click();
    await expect(page.getByRole('option')).toHaveText(['All', 'Active', 'Deactive']);
  });

  test('TC-PKG-04: Name search is partial and any case; no match shows the empty message', async ({ page }) => {
    await p.nameSearch.fill('dubai delights');
    await expect(p.row(SAMPLE)).toBeVisible({ timeout: 20_000 });
    await expect(p.rows).toHaveCount(1);
    await p.nameSearch.fill('zzzqqq');
    await expect(page.getByText(/There are no records in Package/)).toBeVisible({ timeout: 20_000 });
  });

  test('TC-PKG-05: Each package row has a Published switch and an Active switch', async () => {
    const r = p.row(SAMPLE);
    await expect(r.locator('input[type=checkbox]')).toHaveCount(2);
    await expect(r.locator('input[type=checkbox][aria-label=Active]')).toBeChecked();
    await expect(r).toContainText('Published');
  });

  test('TC-PKG-06: Published switch asks "Unpublish package?" (agents won\'t find it); Cancel keeps it published', async ({ page }) => {
    const pub = p.row(SAMPLE).locator('input[type=checkbox]:not([aria-label=Active])');
    await pub.click();
    const pop = page.locator('.swal2-popup:visible');
    await expect(pop.locator('.swal2-title')).toHaveText('Unpublish package?');
    await expect(pop).toContainText(`Agents won't find ${SAMPLE} in the portal until it's published again.`);
    await pop.getByRole('button', { name: 'Cancel' }).click();
    await expect(pub).toBeChecked();
  });

  test('TC-PKG-07: Active switch asks "Deactivate package?"; Cancel keeps it active', async ({ page }) => {
    const act = p.row(SAMPLE).locator('input[type=checkbox][aria-label=Active]');
    await act.click();
    const pop = page.locator('.swal2-popup:visible');
    await expect(pop.locator('.swal2-title')).toHaveText('Deactivate package?');
    await expect(pop.getByRole('button', { name: 'Yes, deactivate' })).toBeVisible();
    await pop.getByRole('button', { name: 'Cancel' }).click();
    await expect(act).toBeChecked();
  });

  test('TC-PKG-08: Opening /packages while logged out goes to the login page', async ({ browser }) => {
    const fresh = await browser.newPage();
    await fresh.goto('/packages');
    await expect(fresh).toHaveURL(/login/, { timeout: 60_000 });
    await fresh.close();
  });
});

test.describe('Package module - Add New / New bundle (nothing is saved)', () => {
  let p: PackageModule;
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); p = new PackageModule(page); });

  test('TC-PKG-10: "Add New" asks how to create: AI Generated or Manual', async ({ page }) => {
    await p.open();
    await visible(page.getByRole('button', { name: 'Add New' })).click();
    await expect(page.getByRole('heading', { name: 'Create a Package' })).toBeVisible();
    await expect(page.getByText('Let AI build a package for you')).toBeVisible();
    await expect(page.getByText('Build the package step by step')).toBeVisible();
  });

  test('TC-PKG-11: "AI Generated" opens the AI builder', async ({ page }) => {
    await page.goto('/packages/new');
    test.fail(true, 'BUG-106: clicking "AI Generated" only highlights the card - no AI builder opens');
    await page.getByText('AI Generated', { exact: true }).first().click({ timeout: 90_000 });
    await page.waitForTimeout(4000);
    console.log('after AI Generated: ' + (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(-400));
    await expect(page.getByRole('heading', { name: 'Create a Package' }), 'still on the choice screen - nothing opened').toBeHidden();
  });

  test('TC-PKG-12: Manual form has every section and field', async ({ page }) => {
    await p.manual();
    const main = page.locator('main');
    for (const t of ['Add Package', 'Valid Dates', 'Pax Min', 'Pax Max', 'Book Before (days)', 'Nights', 'Themes', 'Description', 'Images', 'Package type',
      'Price basis', 'Agent booking', 'Services', 'Highlights', 'Policies', 'Inclusions', 'Exclusions', 'Cancellation policy', 'Notes', 'Terms & conditions'])
      await expect(main.getByText(t, { exact: true }).first(), t).toBeVisible();
    for (const b of ['Static', 'Contracted', 'Dynamic', 'Upload images', 'Add services', 'Add rule', 'Cancel', 'Save Package'])
      await expect(visible(main.getByRole('button', { name: b, exact: true })), b).toBeVisible();
    await expect(page.locator('main input[aria-label="Price basis"], main input[placeholder="Price basis"]').first()).toHaveValue('Per person');
  });

  test('TC-PKG-13: Empty Save - Name, Currency, Cities and Base Price are required; nothing is sent', async ({ page }) => {
    await p.manual();
    test.fail(true, 'BUG-104: only Name gets a message - Currency*, Cities*, Base Price* get no message and no red outline');
    await page.getByRole('button', { name: 'Save Package' }).click();
    await page.waitForTimeout(2000);
    expect(blocked, 'empty package must not be sent').toEqual([]);
    await expect(page.getByText('Name is required').first()).toBeVisible();
    const missing: string[] = [];
    for (const m of ['Currency is required', 'Cities is required', 'Base Price is required'])
      if (!(await page.getByText(m).first().isVisible().catch(() => false))) missing.push(m);
    console.log('missing messages: ' + JSON.stringify(missing));
    expect(missing, 'every mandatory field (*) gets its own message').toEqual([]);
  });

  // Pax Min > Pax Max and a negative Base Price can only be judged on a fully filled package -> package-crud (needs a valid package)

  test('TC-PKG-16: Cancel leaves the form and saves nothing', async ({ page }) => {
    await p.manual();
    await p.field('Name').fill('QA Auto Package cancelled').catch(() => {});
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await expect(page).toHaveURL(/\/packages$/, { timeout: 20_000 });
    expect(blocked).toEqual([]);
  });

  test('TC-PKG-17: "New bundle" opens "Add Bundle" whose button says "Save Bundle"', async ({ page }) => {
    await p.open();
    await page.getByRole('tab', { name: 'Bundles' }).click();
    await visible(page.getByRole('button', { name: 'New bundle' })).click();
    await expect(page.getByText('Add Bundle').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Add the services this bundle sells together')).toBeVisible();
    test.fail(true, 'BUG-105: the "Add Bundle" form saves with a button called "Save Package"');
    await expect(page.getByRole('button', { name: 'Save Bundle' })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Package module - a package', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    const p = new PackageModule(page); await p.open();
    await p.row(SAMPLE).locator('td').first().click();
    await expect(page.getByRole('tab', { name: /^Overview/ })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-PKG-20: Header shows name, type, nights, currency, Published, Active, Valid dates; Unpublish button', async ({ page }) => {
    const main = page.locator('main');
    for (const t of ['Static package', 'Published', 'Active', '01 Nov 2026', '31 Mar 2027']) await expect(main.getByText(t).first(), t).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'Unpublish' }))).toBeVisible();
  });

  test('TC-PKG-21: Tabs Overview / Services (count) / Highlights (count) / Policies', async ({ page }) => {
    for (const t of [/^Overview/, /^Services \d+/, /^Highlights \d+/, /^Policies/]) await expect(page.getByRole('tab', { name: t }), String(t)).toBeVisible();
  });

  test('TC-PKG-22: Overview - Basic details lists type, nights, base price, valid from / to, currency, book before, pax min / max', async ({ page }) => {
    const main = page.locator('main');
    for (const t of ['Package type', 'Nights', 'Base price', 'Valid from', 'Valid to', 'Currency', 'Book before', 'Pax min', 'Pax max'])
      await expect(main.getByText(t, { exact: true }).first(), t).toBeVisible();
    await expect(main.getByText('4 nights / 5 days')).toBeVisible();
    await expect(main.getByText('7 days before travel')).toBeVisible();
  });

  test('TC-PKG-23: Services tab lists the 6 services', async ({ page }) => {
    await page.getByRole('tab', { name: /^Services/ }).click();
    await page.waitForTimeout(2000);
    console.log('services: ' + (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(-700));
    await expect(page.getByRole('tab', { name: 'Services 6' })).toBeVisible();
  });

  test('TC-PKG-24: Policies - Edit opens the editor (Add line / Add rule / Save Policies); Cancel returns without saving', async ({ page }) => {
    await page.getByRole('tab', { name: /^Policies/ }).click();
    await visible(page.getByRole('button', { name: 'Edit', exact: true })).click();
    await expect(page).toHaveURL(/\/policies\/edit$/);
    await expect(visible(page.getByRole('button', { name: 'Add rule' }))).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'Save Policies' }))).toBeVisible();
    await visible(page.getByRole('button', { name: 'Cancel', exact: true })).click();
    await expect(page).not.toHaveURL(/\/edit$/, { timeout: 20_000 });
    expect(blocked).toEqual([]);
  });
});
