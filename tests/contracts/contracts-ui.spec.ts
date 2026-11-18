import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openDialog } from '../../pages/FormHelpers';
import { API_HOST } from '../../env';

/*
 * CONTRACTS MODULE (menu "Contracts" -> /contracts): every supplier's contracts in one list,
 * filters (supplier / status / active / ending), search, bulk Roll over / Extend / Change prices / Activate / Deactivate.
 * SAFETY: every save is BLOCKED - nothing can change.
 */
class ContractsModule {
  constructor(readonly page: Page) {}
  get heading() { return this.page.getByRole('heading', { name: 'Contracts', exact: true }); }
  get search() { return this.page.getByPlaceholder('Contract, code or supplier'); }
  get rows() { return this.page.locator('main tbody tr:visible'); }
  get range() { return this.page.getByText(/^\d+–\d+ of \d+$/); }
  combo(text: string | RegExp) { return this.page.locator('main [role=combobox]:visible', { hasText: text }).first(); }
  get supplierFilter() { return this.page.locator('main [role=combobox]:visible').filter({ has: this.page.locator('xpath=self::input') }).first(); }
  async open() {
    await this.page.goto('/contracts');
    await expect(this.heading).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 90_000 });
    await this.page.waitForTimeout(1500);
  }
  async pick(combo: Locator, option: string) {
    await combo.click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await this.page.waitForTimeout(2500);
  }
  async options(combo: Locator) {
    await combo.click();
    const o = (await this.page.getByRole('option').allInnerTexts()).map(s => s.trim());
    await this.page.keyboard.press('Escape');
    return o;
  }
  cell = (row: Locator, col: number) => row.locator('td').nth(col);
  async column(col: number) { return (await this.rows.locator(`td:nth-child(${col + 1})`).allInnerTexts()).map(s => s.trim()); }
  readonly bulk = (name: string) => this.page.locator('main').getByRole('button', { name, exact: true });
}
// columns: 0 = select box, 1 = Contract, 2 = Supplier, 3 = Service, 4 = Valid, 5 = Status, 6 = Rates
const C = { contract: 1, supplier: 2, service: 3, valid: 4, status: 5, rates: 6 };

test.describe('Contracts module - list, filters, search', () => {
  let c: ContractsModule;
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); c = new ContractsModule(page); await c.open(); });
  test.afterEach(() => expect(blocked, 'nothing may be saved').toEqual([]));

  test('TC-CTM-01: Opens from the menu "Contracts" with the heading and "Every supplier\'s contracts." @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Contracts', exact: true }).click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(c.heading).toBeVisible();
    await expect(page.getByText("Every supplier's contracts.")).toBeVisible();
  });

  test('TC-CTM-02: Columns Contract, Supplier, Service, Valid, Status, Rates', async ({ page }) => {
    await expect(page.locator('main thead th:visible')).toContainText(['Contract', 'Supplier', 'Service', 'Valid', 'Status', 'Rates']);
  });

  test('TC-CTM-03: Default filters - Any status, Active, Ending any time, 50 rows per page', async () => {
    await expect(c.combo('Any status')).toBeVisible();
    await expect(c.combo(/^Active$/)).toBeVisible();
    await expect(c.combo('Ending any time')).toBeVisible();
    await expect(c.combo(/^50$/)).toBeVisible();
  });

  test('TC-CTM-04: Status filter offers Any status / Draft / Pending approval / Approved / Rejected / Expired', async () => {
    expect(await c.options(c.combo('Any status'))).toEqual(['Any status', 'Draft', 'Pending approval', 'Approved', 'Rejected', 'Expired']);
  });

  test('TC-CTM-05: Active filter offers Active / Inactive / Active and inactive; Ending offers 30 / 60 / 90 / 180 days', async () => {
    expect(await c.options(c.combo(/^Active$/))).toEqual(['Active', 'Inactive', 'Active and inactive']);
    expect(await c.options(c.combo('Ending any time'))).toEqual(['Ending any time', 'Ending in 30 days', 'Ending in 60 days', 'Ending in 90 days', 'Ending in 180 days']);
  });

  for (const status of ['Draft', 'Approved']) {
    test(`TC-CTM-06-${status}: Status "${status}" shows only ${status} contracts`, async () => {
      await c.pick(c.combo('Any status'), status);
      await expect(async () => {
        const st = await c.column(C.status);
        expect(st.length).toBeGreaterThan(0);
        expect(new Set(st)).toEqual(new Set([status]));
      }).toPass({ timeout: 20_000 });
    });
  }

  test('TC-CTM-07: "Inactive" lists only deactivated contracts (the QA Auto ones end up here)', async () => {
    const activeCount = await c.rows.count();
    await c.pick(c.combo(/^Active$/), 'Inactive');
    await expect(c.rows.first()).toBeVisible();
    const names = await c.column(C.contract);
    console.log(`inactive: ${names.length} (active: ${activeCount})`);
    expect(names.some(n => n.startsWith('QA Auto')), 'QA Auto contracts are deactivated after every run').toBe(true);
    await c.pick(c.combo('Inactive'), 'Active and inactive');
    await expect(async () => expect(await c.rows.count()).toBeGreaterThanOrEqual(Math.min(50, activeCount + names.length))).toPass({ timeout: 20_000 });
  });

  test('TC-CTM-08: Search finds by contract name, part of it, any case', async () => {
    await c.search.fill('connaught demo');
    await expect(async () => { const n = await c.column(C.contract); expect(n.length).toBeGreaterThan(0); expect(n.every(x => /connaught demo/i.test(x))).toBe(true); }).toPass({ timeout: 20_000 });
  });

  test('TC-CTM-09: Search finds by contract code (CDR-2627) and by supplier name (Desert Line)', async () => {
    await c.search.fill('CDR-2627');
    await expect(c.rows.first()).toContainText('CDR-2627', { timeout: 20_000 });
    await c.search.fill('Desert Line');
    await expect(async () => { const s = await c.column(C.supplier); expect(s.length).toBeGreaterThan(0); expect(s.every(x => /Desert Line/.test(x))).toBe(true); }).toPass({ timeout: 20_000 });
  });

  test('TC-CTM-10: No match shows "No contracts match these filters." and 0–0 of 0', async ({ page }) => {
    await c.search.fill('zzzqqq');
    await expect(page.getByText('No contracts match these filters.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('0–0 of 0')).toBeVisible();
  });

  test('TC-CTM-11: Supplier filter shows only that supplier\'s contracts', async ({ page }) => {
    const box = page.locator('main input[placeholder="All suppliers"], main input[value="All suppliers"]').first();
    await box.click(); await box.fill('Arabian');
    await page.getByRole('option', { name: 'Arabian Nights Tours' }).click();
    await expect(async () => { const s = await c.column(C.supplier); expect(s.length).toBeGreaterThan(0); expect(new Set(s)).toEqual(new Set(['Arabian Nights Tours'])); }).toPass({ timeout: 20_000 });
  });

  test('TC-CTM-13: Valid dates show the year (a contract runs 15 Oct 2026 - 14 Oct 2027)', async () => {
    test.fail(true, 'BUG-101: "Valid" shows "15 Oct – 14 Oct" with no year - the end looks earlier than the start');
    const v = await c.column(C.valid);
    for (const x of v) expect(x, 'Valid has a year').toMatch(/\d{4}/);
  });

  test('TC-CTM-14: Rows per page offers 25 / 50 / 100 / 200; the range text matches the rows', async () => {
    expect(await c.options(c.combo(/^50$/))).toEqual(['25', '50', '100', '200']);
    const n = await c.rows.count();
    await expect(c.range).toHaveText(new RegExp(`^${n ? 1 : 0}–${n} of \\d+$`));
  });

  test('TC-CTM-15: Clicking a contract opens THAT contract', async ({ page }) => {
    test.fail(true, 'BUG-102: a contract row opens the supplier\'s "Choose a product type" page, not the contract');
    const name = (await c.column(C.contract))[0];
    await c.cell(c.rows.first(), C.contract).click();
    await page.waitForTimeout(5000);
    await expect(page.getByRole('heading', { name: new RegExp(name.split(' ')[0]) }).first(), 'contract editor opens').toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Choose a product type')).toBeHidden();
  });

  test('TC-CTM-16: Opening /contracts while logged out goes to the login page', async ({ browser }) => {
    const fresh = await browser.newPage();
    await fresh.goto('/contracts');
    await expect(fresh).toHaveURL(/login/, { timeout: 60_000 });
    await fresh.close();
  });
});

test.describe('Contracts module - bulk actions (nothing is saved)', () => {
  let c: ContractsModule;
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page); c = new ContractsModule(page); await c.open();
    await c.rows.first().locator('input[type=checkbox]').check();
  });

  test('TC-CTM-20: Ticking a contract shows "1 selected" and Roll over / Extend / Change prices / Activate / Deactivate / Clear', async ({ page }) => {
    await expect(page.getByText('1 selected')).toBeVisible();
    for (const b of ['Roll over', 'Extend', 'Change prices', 'Activate', 'Deactivate', 'Clear']) await expect(c.bulk(b), b).toBeVisible();
    await c.bulk('Clear').click();
    await expect(page.getByText('1 selected')).toBeHidden();
    await expect(c.rows.first().locator('input[type=checkbox]')).not.toBeChecked();
  });

  test('TC-CTM-21: "Select all" ticks every contract on the page', async ({ page }) => {
    await page.locator('main thead input[type=checkbox]').check();
    const n = await c.rows.count();
    await expect(page.getByText(`${n} selected`)).toBeVisible();
  });

  test('TC-CTM-22: Roll over - years 0..5, price change -50..200 %, copies are new Drafts', async ({ page }) => {
    await c.bulk('Roll over').click();
    const d = openDialog(page);
    await expect(d).toContainText('Roll over contracts');
    await expect(d).toContainText('1 contract selected');
    await expect(d).toContainText('Each copy is a new Draft contract');
    await expect(d).toContainText('−50 to 200');
    const move = d.getByRole('combobox', { name: 'Move dates by' });   // a native <select>
    expect((await move.locator('option').allInnerTexts()).map(s => s.trim())).toEqual(['Keep the same dates', '1 year', '2 years', '3 years', '4 years', '5 years']);
    await page.keyboard.press('Escape');
    expect(blocked).toEqual([]);
  });

  test('TC-CTM-23: Roll over - a price change outside -50..200 % is refused with "must be between -50% and 200%"', async ({ page }) => {
    // let ONLY the preview through (it calculates, never saves); the server checks the range
    await page.route(`**/${API_HOST}/**/contracts/bulk`, route => /"preview":true/.test(route.request().postData() || '') ? route.continue() : route.abort());
    await c.bulk('Roll over').click();
    const d = openDialog(page);
    await d.locator('input[type=number], input[inputmode=decimal], input[inputmode=numeric]').first().fill('250');
    await d.getByRole('button', { name: 'Preview' }).click();
    await expect(d.getByText('The price change must be between -50% and 200%.')).toBeVisible({ timeout: 30_000 });
    expect(blocked, 'nothing but the preview').toEqual([]);
  });

  test('TC-CTM-24: Extend - "New valid-to date" is required and warns approved contracts go back to Draft', async ({ page }) => {
    await c.bulk('Extend').click();
    const d = openDialog(page);
    await expect(d).toContainText('Extend contracts');
    await expect(d).toContainText('New valid-to date');
    await expect(d).toContainText('approved contracts go back to Draft');
    await expect(d.getByRole('button', { name: 'Preview' }), 'Preview stays off until a date is chosen').toBeDisabled();
    expect(blocked, 'no date -> nothing sent').toEqual([]);
  });

  test('TC-CTM-25: Change prices - opens with the selected count and a percentage', async ({ page }) => {
    await c.bulk('Change prices').click();
    const d = openDialog(page);
    await expect(d).toContainText('1 contract selected');
    console.log('Change prices: ' + (await d.innerText()).replace(/\s+/g, ' ').slice(0, 400));
    await expect(d.locator('input').first()).toBeVisible();
  });

  test('TC-CTM-26: Deactivate opens "Deactivate contracts" with the count and a Preview; closing it changes nothing', async ({ page }) => {
    await c.bulk('Deactivate').click();
    const d = openDialog(page);
    await expect(d).toContainText('Deactivate contracts');
    await expect(d).toContainText('1 contract selected');
    await expect(d.getByRole('button', { name: 'Preview' })).toBeVisible();
    await d.getByRole('button', { name: 'Close' }).or(d.getByRole('button', { name: '×' })).first().click();
    await expect(d).toBeHidden();
    // opening may ask the server for a PREVIEW (blocked here) - nothing else may be sent
    expect(blocked.filter(b => !b.includes('/contracts/bulk')), 'only a preview request').toEqual([]);
    await expect(c.rows.first()).toBeVisible();
  });
});
