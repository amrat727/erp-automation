import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage, ContractsListPage } from '../../pages/ContractPage';

/*
 * SUPPLIER -> PRODUCTS -> CONTRACT / ALLOTMENT / PROMOTIONS / RATE CHECK  +  the global Contracts list.
 * READ-ONLY: every save is blocked (only the "rate-quote" price check is let through - it saves nothing).
 * Data used:  supplier 18 "Testing season 3" (Hotel: rooms Club + Family, no contracts yet)
 *             supplier 10 "Marina Bay Hotel"  (Hotel: contract "Marina Bay Hotel 2026-27 (BB)" MBH-2627, Approved, 10 rates)
 */
const EMPTY = 18;     // Testing season 3
const FULL = 10;      // Marina Bay Hotel
const MBH = 'Marina Bay Hotel 2026-27 (BB)';

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace('Sept', 'Sep');

let blocked: string[];
let c: ContractPage;
test.beforeEach(async ({ page }) => {
  blocked = await blockWrites(page, /rate-quote/);
  c = new ContractPage(page);
});

test.describe('Supplier product: Contract list', () => {
  test('TC-CON-01: A product has the sub-tabs Products / Contract / Allotment / Promotions / Rate check', async () => {
    await c.openProduct(EMPTY, 'Hotel');
    for (const t of ['Products', 'Contract', 'Allotment', 'Promotions', 'Rate check'] as const) await expect(c.subTab(t)).toBeVisible();
  });

  test('TC-CON-02: Contract list shows Contract, Validity, Rooms and rates, Priority, Status, Active', async ({ page }) => {
    await c.openProduct(FULL, 'Hotel', 'Contract');
    for (const h of ['Contract', 'Validity', 'Rooms and rates', 'Priority', 'Status', 'Active'])
      await expect(c.table.getByRole('columnheader', { name: new RegExp(`^${h}`) })).toBeVisible();
    const row = c.rows.filter({ hasText: MBH });
    await expect(row).toContainText('MBH-2627');
    await expect(row).toContainText('10 rates');
    await expect(row).toContainText('Approved');
    await expect(page.getByText('Import from Excel').last()).toBeVisible();
    await expect(c.button('Add contract')).toBeVisible();
  });

  test('TC-CON-03: Contract search - a match keeps the row, no match shows "No records match these filters."', async ({ page }) => {
    await c.openProduct(FULL, 'Hotel', 'Contract');
    const search = c.table.locator('input[placeholder="Search"]:not(.MuiSelect-nativeInput)').first();
    await search.fill('MBH');
    await expect(c.rows.filter({ hasText: MBH })).toBeVisible();
    await search.fill('zzz-no-such-contract');
    await expect(page.getByText('No records match these filters.').last()).toBeVisible();
  });

  test('TC-CON-04: A product without contracts shows "There are no records in Contract"', async () => {
    await c.openProduct(EMPTY, 'Hotel', 'Contract');
    // Testing season 3 may hold QA contracts by now: either the empty message or the contract rows
    await expect(c.emptyMessage.or(c.rows.first())).toBeVisible();
    if (await c.emptyMessage.isVisible()) await expect(c.emptyMessage).toHaveText('There are no records in Contract');
  });

  test('TC-CON-05: Import from Excel - template for this supplier, .xlsx up to 5 MB, saved as a Draft', async ({ page }) => {
    await c.openProduct(EMPTY, 'Hotel', 'Contract');
    await page.getByText('Import from Excel').last().click();
    const d = page.getByRole('dialog').last();
    await expect(d).toContainText('Upload contract from Excel');
    await expect(d).toContainText('saved as a Draft');
    await expect(d).toContainText(/Made for\s*Testing season 3/);
    await expect(d).toContainText('up to 5 MB');
    await expect(d.getByRole('button', { name: 'Download' })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Create contract' })).toBeDisabled();   // nothing uploaded yet
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(d).toBeHidden();
    expect(blocked).toEqual([]);
  });
});

test.describe('Supplier product: Add contract (nothing is saved)', () => {
  test('TC-CON-10: Defaults - Active Yes, Rate for Both, valid & sell dates = today .. one year less a day', async () => {
    await c.openAddContract(EMPTY, 'Hotel');
    await expect(c.notSaved).toBeVisible();
    await expect(c.page.locator('main :text("Active") ~ * input[type=checkbox], main input[type=checkbox]:visible').first()).toBeChecked();
    await expect(c.page.locator('main input[value="Both"]:visible')).toBeVisible();
    const today = new Date();
    const end = new Date(today); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() - 1);
    expect(await c.dateValues()).toEqual([fmt(today), fmt(end), fmt(today), fmt(end)]);
    await expect(c.page.getByText('Choose the base plan to open rates, supplements and the other sections.')).toBeVisible();
  });

  test('TC-CON-11: Empty Save shows "2 problems to fix" (Contract name, Base plan) and sends nothing', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.saveButton.click();
    await expect(c.problems).toHaveText('2 problems to fix');
    await page.waitForTimeout(1500);
    expect(blocked).toEqual([]);
  });

  test('TC-CON-12: Base plan offers Room only / Bed and breakfast / Half board / Full board / All inclusive', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.basePlan.click();
    await expect(page.getByRole('option')).toHaveText(['Room only', 'Bed and breakfast', 'Half board', 'Full board', 'All inclusive']);
  });

  test('TC-CON-13: Currency offers only the supplier\'s currencies (AED, the default)', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.currency.click();
    await expect(page.getByRole('option')).toHaveText([/UAE Dirham \(AED\).*default/]);
  });

  test('TC-CON-14: Markets offers the company markets', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.markets.click();
    await expect(page.getByRole('option', { name: 'Default Market' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Asian Market' })).toBeVisible();
  });

  test('TC-CON-15: Choosing a base plan opens Rates, Rules, Supplements, Child policy, Cancellation policy, Notes, Contract file', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.pick(c.basePlan, 'Bed and breakfast');
    for (const s of ['Rates', 'Seasons', 'Prices', 'Rules', 'Supplements', 'Meal supplements', 'Other supplements', 'Child policy', 'Cancellation policy', 'Notes and terms', 'Contract file'])
      await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible();
    await expect(page.getByText('No child bands yet. Without one, children are charged as adults.')).toBeVisible();
    await expect(page.getByText('Upload the signed contract')).toBeVisible();
  });

  test('TC-CON-16: Currency is required - a contract without a currency is NOT sent', async ({ page }) => {
    test.fail(true, 'BUG: Currency has a * but an empty Currency is not checked - the contract is sent to the server without a currency');
    await c.openAddContract(EMPTY, 'Hotel');
    await c.name.fill('QA Auto Contract no currency');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.saveButton.click();
    await page.waitForTimeout(3000);
    expect(blocked, 'a contract with NO currency was sent').toEqual([]);
  });

  test('TC-CON-17: "Valid to" earlier than "Valid from" is refused by the field', async () => {
    await c.openAddContract(EMPTY, 'Hotel');
    const before = await c.dateValues();
    await c.setDate(1, '10 Jan 2026');
    expect((await c.dateValues())[1]).toBe(before[1]);
  });

  test('TC-CON-18: Changing "Valid to" also moves "Sell to"', async () => {
    await c.openAddContract(EMPTY, 'Hotel');
    const next = new Date(); next.setMonth(next.getMonth() + 3);
    await c.setDate(1, fmt(next));
    const v = await c.dateValues();
    expect(v[1]).toBe(fmt(next));
    expect(v[3]).toBe(fmt(next));
  });

  test('TC-CON-19: "Sell from" after "Sell to" is a problem to fix and nothing is sent', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.name.fill('QA Auto Contract dates');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    const end = (await c.dateValues())[3];
    const after = new Date(end); after.setDate(after.getDate() + 10);
    await c.setDate(2, fmt(after));
    await c.saveButton.click();
    await expect(c.problems).toHaveText('1 problem to fix');
    await page.waitForTimeout(1500);
    expect(blocked).toEqual([]);
  });

  test('TC-CON-20: Priority below 0 is not accepted', async ({ page }) => {
    test.fail(true, 'BUG: the Priority field has min 0, but a priority of -5 is sent to the server');
    await c.openAddContract(EMPTY, 'Hotel');
    await c.name.fill('QA Auto Contract priority');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.priority.fill('-5');
    await c.priority.press('Tab');
    await c.saveButton.click();
    await page.waitForTimeout(3000);
    expect(blocked, 'a contract with priority -5 was sent').toEqual([]);
  });

  test('TC-CON-21: Add season builds the price sheet; missing prices and missing allotment are warned about', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.keepRooms();                                   // only Club + Family (other suites add QA rooms)
    await c.button('Add season').click();
    const d = page.getByRole('dialog').last();
    for (const f of ['Name', 'From', 'To', 'Nights', 'Min stay', 'Max stay']) await expect(d.getByText(f, { exact: true }).first()).toBeVisible();
    await d.getByPlaceholder('Enter a season name').fill('QA Season');
    await d.getByRole('button', { name: 'Add season' }).click();
    await expect(d).toBeHidden();
    for (const p of ['Club Single', 'Club Double', 'Family Single', 'Family Double']) await expect(c.price(p, 'QA Season'), p).toBeVisible();
    await c.setPrice('Club Single', 'QA Season', '450');
    await expect(c.price('Club Single', 'QA Season')).toHaveValue(/450/);
    await expect(page.getByText(/3 prices are missing/)).toBeVisible();
    await expect(page.getByText(/No allotment holds Club/)).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-CON-22: Cancel with unsaved changes asks "Discard unsaved changes?"', async ({ page }) => {
    await c.openAddContract(EMPTY, 'Hotel');
    await c.name.fill('QA Auto Contract discard');
    await c.cancelButton.click();
    const d = page.getByRole('dialog').last();
    await expect(d).toContainText('Discard unsaved changes?');
    await d.getByRole('button', { name: 'Discard' }).click();
    await expect(c.button('Add contract')).toBeVisible({ timeout: 30_000 });
    expect(blocked).toEqual([]);
  });
});

test.describe('Supplier product: an approved contract (nothing is saved)', () => {
  test.beforeEach(async () => {
    await c.openProduct(FULL, 'Hotel', 'Contract');
    await c.rows.filter({ hasText: MBH }).locator('td').first().click();
    await expect(c.name).toHaveValue(MBH, { timeout: 60_000 });
  });

  test('TC-CON-30: The contract opens with its saved details', async ({ page }) => {
    await expect(c.code).toHaveValue('MBH-2627');
    await expect(c.basePlan).toHaveValue('Bed and breakfast');
    await expect(c.priority).toHaveValue('1');
    expect((await c.dateValues()).slice(0, 4)).toEqual(['25 Oct 2026', '31 Oct 2027', '20 Oct 2026', '25 Oct 2027']);
    await expect(page.getByText('10 rates').last()).toBeVisible();
    await expect(page.getByText('All changes saved.').last()).toBeVisible();
  });

  test('TC-CON-31: Rates can be shown as a Sheet or as Rows (10 rows)', async ({ page }) => {
    await expect(c.price('Deluxe Room Marina View Single', 'Peak')).toHaveValue('650.00');
    await page.locator('main :text-is("Rows"):visible').last().click();
    await expect(page.getByRole('button', { name: 'Add rate' }).last()).toBeVisible();
    await expect(page.locator('main input[placeholder="Min"]:visible')).toHaveCount(10);
  });

  test('TC-CON-32: Saving an approved contract warns it goes back to Draft; Cancel keeps it', async ({ page }) => {
    await c.saveButton.click();
    const d = page.getByRole('dialog').last();
    await expect(d).toContainText('Save and return to Draft?');
    await expect(d).toContainText('will not price bookings');
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(d).toBeHidden();
    expect(blocked).toEqual([]);
  });

  test('TC-CON-33: Emptying the name of an approved contract is stopped before the Draft question', async ({ page }) => {
    await c.name.fill('');
    await c.saveButton.click();
    await page.waitForTimeout(1500);
    // expected: "1 problem to fix" on the name - NOT the "Save and return to Draft?" question
    await expect(c.problems).toHaveText('1 problem to fix');
    expect(blocked).toEqual([]);
  });
});

test.describe('Supplier product: Allotment, Promotions, Rate check', () => {
  test('TC-CON-40: Allotment list shows Marina Bay\'s 2 guaranteed allotments with release days and sold count', async () => {
    await c.openProduct(FULL, 'Hotel', 'Allotment');
    await expect(c.rows).toHaveCount(2);
    await expect(c.rows.first()).toContainText('Guaranteed');
    await expect(c.rows.first()).toContainText(/\d+-day release/);
    await expect(c.rows.first()).toContainText(/\d+ of \d+/);
  });

  test('TC-CON-41: Add allotment form - details, inventory blocks, release; empty Save sends nothing', async ({ page }) => {
    await c.openProduct(EMPTY, 'Hotel', 'Allotment');
    await expect(c.emptyMessage.or(c.rows.first())).toBeVisible();
    await c.button('Add allotment').click();
    for (const s of ['Allotment details', 'Allotment name', 'Valid from', 'Valid to', 'Inventory by date', 'Release', 'Notes'])
      await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main :text-is("Per day"):visible').first()).toBeVisible();
    await expect(page.locator('main :text-is("Shared pool"):visible').first()).toBeVisible();
    await c.saveButton.click();
    await expect(c.problems).toBeVisible();
    await page.waitForTimeout(1500);
    expect(blocked).toEqual([]);
  });

  test('TC-CON-45: Promotions list shows Marina Bay\'s "Early bird 15%" promotion', async () => {
    await c.openProduct(FULL, 'Hotel', 'Promotions');
    const row = c.rows.filter({ hasText: 'Early bird 15%' });
    await expect(row).toContainText('MBH-EB15');
    await expect(row).toContainText('Approved');
    await expect(row).toContainText('Min 3 nights');
  });

  test('TC-CON-46: Add promotion form - 5 benefit types; empty Save sends nothing', async ({ page }) => {
    await c.openProduct(EMPTY, 'Hotel', 'Promotions');
    await expect(c.emptyMessage.or(c.rows.first())).toBeVisible();
    await c.button('Add promotion').click();
    for (const s of ['Promotion name', 'Booking window & stay rules', 'Blackout dates', 'Benefits', 'Discount', 'Stay / pay', 'Meal upgrade', 'Room upgrade', 'Free of charge (FOC)'])
      await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible({ timeout: 30_000 });
    await c.saveButton.click();
    await expect(c.problems).toBeVisible();
    await page.waitForTimeout(1500);
    expect(blocked).toEqual([]);
  });

  test('TC-CON-50: Rate check prices a stay at Marina Bay and shows the breakdown', async ({ page }) => {
    test.skip(true, 'Rate check is out of scope for now (product owner, 16-Nov-2026)');
    await c.openProduct(FULL, 'Hotel', 'Rate check');
    for (const f of ['Room category', 'Check-in', 'Nights', 'Rooms', 'Adults per room', 'Board', 'Market', 'Booked on'])
      await expect(page.locator(`main :text-is("${f}"):visible`).first(), f).toBeVisible();
    const quote = page.waitForResponse(r => /rate-quote/.test(r.url()), { timeout: 60_000 });
    await c.button('Check rate').click();
    expect((await quote).ok()).toBe(true);
    await expect(page.getByText('Set up a stay and press Check rate')).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('main').getByText(/AED/).first()).toBeVisible();
  });
});

test.describe('Contracts list (menu "Contracts")', () => {
  let l: ContractsListPage;
  test.beforeEach(async ({ page }) => { l = new ContractsListPage(page); await l.open(); });

  test('TC-CON-60: Lists every supplier\'s contracts with Contract, Supplier, Service, Valid, Status, Rates', async ({ page }) => {
    for (const h of ['Contract', 'Supplier', 'Service', 'Valid', 'Status', 'Rates']) await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
    await expect(l.rows.filter({ hasText: MBH })).toContainText('Marina Bay Hotel');
    await expect(page.getByText('Tick contracts to roll over, extend or reprice them together.')).toBeVisible();
  });

  test('TC-CON-61: Search by code "MBH-2627" finds the Marina Bay contract only', async () => {
    await l.search.fill('MBH-2627');
    await expect(l.rows).toHaveCount(1, { timeout: 30_000 });
    await expect(l.rows.first()).toContainText(MBH);
  });

  test('TC-CON-62: Status filter "Draft" shows only Draft contracts', async ({ page }) => {
    await l.filter(1).click();
    await page.getByRole('option', { name: 'Draft', exact: true }).click();
    await expect(async () => {
      const st = await l.column(6);
      expect(st.length).toBeGreaterThan(0);
      expect(st.every(s => s === 'Draft')).toBe(true);
    }).toPass({ timeout: 30_000 });
  });

  test('TC-CON-63: Ticking a contract shows Roll over / Extend / Change prices / Activate / Deactivate; Clear hides them', async ({ page }) => {
    await l.rows.first().getByRole('checkbox').check();
    await expect(l.bulkBar).toHaveText('1 selected');
    for (const b of ['Roll over', 'Extend', 'Change prices', 'Activate', 'Deactivate']) await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(l.bulkBar).toBeHidden();
    expect(blocked).toEqual([]);
  });

  test('TC-CON-64: Clicking a contract opens it under the supplier\'s product', async ({ page }) => {
    await l.rows.filter({ hasText: MBH }).getByText(MBH).click();
    await expect(page).toHaveURL(/\/suppliers\/10\/products/, { timeout: 60_000 });
    await expect(page.locator('main :visible').getByText(/SUP-002/).first()).toBeVisible({ timeout: 60_000 });
  });

  test('TC-CON-65: "Valid" shows the year, so a one-year contract does not look like it ends before it starts', async () => {
    test.fail(true, 'BUG: "Valid" shows "15 Oct – 14 Oct" for 15 Oct 2026 - 14 Oct 2027 (no year), so it reads as ending before it starts');
    const valid = await l.column(5);
    expect(valid.length).toBeGreaterThan(0);
    expect(valid.filter(v => !/20\d\d|\b[A-Z][a-z]{2} \d{2}\b/.test(v)), 'rows whose "Valid" has no year').toEqual([]);
  });
});
