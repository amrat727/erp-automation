import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { SupplierPage, columnFilter } from '../../pages/SupplierPage';

/*
 * SUPPLIER - screen checks (READ-ONLY: every save is blocked, real suppliers are never changed).
 * Run:  npx playwright test --project=supplier supplier-ui
 * Real data used: "Marina Bay Hotel" (SUP-002, Approved), "Testing season 3" (ABD-001, On hold).
 */
let blocked: string[];
let s: SupplierPage;
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); s = new SupplierPage(page); });

// ======================= LIST =======================
test.describe('Supplier list', () => {
  test('TC-SUP-01: Opens from the menu "Supplier" at /suppliers @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Supplier', exact: true }).click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/suppliers$/);
    await expect(s.heading).toBeVisible({ timeout: 60_000 });
  });

  test('TC-SUP-02: Toolbar has "Add supplier", "Audit history" and "Columns"', async () => {
    await s.open();
    for (const b of [s.addButton, s.auditButton, s.columnsButton]) await expect(b).toBeVisible();
  });

  test('TC-SUP-03: Table has Name and Code search and a Status filter', async ({ page }) => {
    await s.open();
    // stage 20 Nov 2026: each filter opens from the icon in its column header (one at a time)
    await expect(await columnFilter(page, /^Name/)).toBeVisible();
    await expect(await columnFilter(page, /^Code/)).toBeVisible();
    await expect(await columnFilter(page, /Status/, 'combobox')).toHaveText('All');
  });

  test('TC-SUP-04: Status filter offers All / Approved / On hold / Blocked', async ({ page }) => {
    await s.open();
    const f = await columnFilter(page, /Status/, 'combobox');
    if (!(await page.getByRole('listbox').last().isVisible().catch(() => false))) await f.click();
    await expect(page.getByRole('option')).toHaveText(['All', 'Approved', 'On hold', 'Blocked']);
  });

  for (const st of ['Approved', 'On hold'] as const) {
    test(`TC-SUP-05: Filter "${st}" shows only ${st} suppliers`, async () => {
      await s.open();
      await s.filterStatus(st);
      await expect(s.rows.first()).toBeVisible();
      await expect(async () => expect(new Set(await s.statuses())).toEqual(new Set([st]))).toPass({ timeout: 20_000 });
    });
  }

  test('TC-SUP-06: Search by name finds "Marina Bay Hotel" (case-insensitive, part of the name)', async () => {
    await s.open();
    await s.search('marina bay');
    await expect(s.rows).toHaveCount(1);
    await expect(s.rows.first()).toContainText('Marina Bay Hotel');
  });

  test('TC-SUP-07: Search by code "SUP-002" finds Marina Bay Hotel', async ({ page }) => {
    await s.open();
    await (await columnFilter(page, /^Code/)).fill('SUP-002');
    await expect(s.rows).toHaveCount(1, { timeout: 30_000 });
    await expect(s.rows.first()).toContainText('Marina Bay Hotel');
  });

  test('TC-SUP-08: Search with no match shows "There are no records in Supplier"', async ({ page }) => {
    await s.open();
    await (await columnFilter(page, /^Name/)).fill('zzqqxx no such supplier');
    await expect(s.emptyMessage).toBeVisible({ timeout: 30_000 });
  });

  test('TC-SUP-09: Search ignores spaces before/after the text', async ({ page }) => {
    // BUG-47 fixed on the stage build of 21 Nov 2026 (was: 'BUG: searching "  Marina Bay Hotel  " (spaces around) finds nothing - the search does not trim')
    await s.open();
    await (await columnFilter(page, /^Name/)).fill('  Marina Bay Hotel  ');
    await expect(s.rows.filter({ hasText: 'Marina Bay Hotel' })).toHaveCount(1, { timeout: 30_000 });
  });

  test('TC-SUP-10: Paging - 10 rows per page, the range text matches, Next shows the rest', async ({ page }) => {
    await s.open();
    await expect(s.rangeText).toHaveText(/^1–\d+ of \d+$/);
    const total = Number((await s.rangeText.innerText()).split(' of ')[1]);
    await expect(s.rows).toHaveCount(Math.min(10, total));
    test.skip(total <= 10, 'only one page');
    const first = await s.names();
    await page.getByRole('button', { name: /next page/i }).click();
    await expect(s.rangeText).toHaveText(`11–${Math.min(20, total)} of ${total}`);
    await expect(s.rows).toHaveCount(Math.min(10, total - 10));
    // several QA suppliers share a name - compare the unique codes
    const codes = async () => (await s.rows.locator('td:nth-child(2)').allInnerTexts()).map(x => x.trim());
    await page.getByRole('button', { name: /previous page/i }).click();
    const firstCodes = await codes();
    await page.getByRole('button', { name: /next page/i }).click();
    await expect(s.rangeText).toHaveText(`11–${Math.min(20, total)} of ${total}`);
    expect((await codes()).some(cd => firstCodes.includes(cd)), 'page 2 repeats page 1').toBe(false);
  });

  test('TC-SUP-11: Every supplier code is unique', async ({ page }) => {
    await s.open();
    // biggest page first: other tests add suppliers while this one pages through, which shifts the pages
    const perPage = page.locator('main').getByRole('combobox').filter({ hasText: /^\d+$/ }).last();
    if (await perPage.count()) { await perPage.click(); await page.getByRole('option').last().click(); await page.waitForTimeout(2500); }
    const codes: string[] = [];
    for (;;) {
      codes.push(...(await s.rows.locator('td:nth-child(2)').allInnerTexts()).map(c => c.trim()));
      const next = page.getByRole('button', { name: /next page/i });
      if (!(await next.isEnabled())) break;
      await next.click();
      await page.waitForTimeout(2000);
    }
    const dup = codes.filter((c, i) => c && codes.indexOf(c) !== i);
    expect(dup, 'duplicate supplier codes').toEqual([]);
  });

  test('TC-SUP-12: Clicking "Name" sorts A->Z, again Z->A', async ({ page }) => {
    // names saved with spaces around them (BUG-80) sort first: leave them out of the order check
    const rawNames = async () => (await page.locator('main tbody tr:visible td:first-child').evaluateAll(els => els.map(e => e.textContent ?? ''))).filter(n => n === n.trim());
    await s.open();
    // the sort control is its own button ("Sort by Name" on the stage build of 20 Nov 2026)
    const header = page.locator('main thead th').first().getByRole('button', { name: 'Name', exact: true });
    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    // retried: a parallel test may rename a supplier while the list is being sorted
    await expect(async () => {
      await s.open();
      await header.click();
      await page.waitForTimeout(1500);
      const asc = (await rawNames()).map(n => n.toLowerCase());
      expect(asc).toEqual([...asc].sort(cmp));
      await header.click();
      await page.waitForTimeout(1500);
      const desc = (await rawNames()).map(n => n.toLowerCase());
      expect(desc).toEqual([...desc].sort(cmp).reverse());
    }).toPass({ timeout: 90_000 });
  });

  test('TC-SUP-14: Supplier names are saved without spaces before / after the name', async ({ page }) => {
    test.fail(true, 'BUG-80: supplier names are saved untrimmed ("   QA Auto Supplier ... edited   ", "Amrat Testing Partner ") and sort before "A"');
    await s.open();
    const names = await page.locator('main tbody tr:visible td:first-child').evaluateAll(els => els.map(e => e.textContent ?? ''));
    expect(names.filter(n => n !== n.trim()), 'names with spaces around them').toEqual([]);
  });

  test('TC-SUP-13: Opening /suppliers while logged out goes to the login page', async ({ browser }) => {
    const p = await browser.newPage();
    await p.goto('/suppliers');
    await expect(p).toHaveURL(/login/, { timeout: 60_000 });
    await p.close();
  });
});

// ======================= ADD FORM (nothing is saved) =======================
test.describe('Add supplier form', () => {
  test('TC-SUP-20: Form has Basic details, Financial and Services offered sections', async ({ page }) => {
    await s.openAdd();
    for (const h of ['Basic details', 'Financial', 'Services offered']) await expect(page.getByRole('button', { name: new RegExp('^' + h) }).first()).toBeVisible();
    for (const f of [s.name, s.city, s.currency, s.branch, s.department, s.days, s.serviceSearch]) await expect(f).toBeVisible();
    await expect(s.createButton).toBeVisible();
  });

  test('TC-SUP-21: Defaults: Payment due "Days after invoice", Days 30, Advance type "Percentage", Advance 0', async ({ page }) => {
    await s.openAdd();
    await expect(page.locator('main input[placeholder="Days after invoice"]:visible, main input[value="Days after invoice"]:visible').first()).toBeVisible();
    await expect(s.days).toHaveValue('30');
    await expect(page.locator('main input[value="Percentage"]:visible').first()).toBeVisible();
    await expect(s.advance).toHaveValue('0');
  });

  test('TC-SUP-22: Status buttons Approved / On hold / Blocked - a new supplier starts "On hold"', async () => {
    await s.openAdd();
    for (const b of ['Approved', 'On hold', 'Blocked'] as const) await expect(s.statusButton(b)).toBeVisible();
    // the selected status is shown only by its colour (no aria-pressed on the stage build of 21 Nov 2026)
    const bg = (n: 'Approved' | 'On hold' | 'Blocked') => s.statusButton(n).evaluate(e => getComputedStyle(e).backgroundColor);
    expect(await bg('On hold'), 'On hold is the selected one').not.toBe('rgba(0, 0, 0, 0)');
    for (const n of ['Approved', 'Blocked'] as const) expect(await bg(n), n + ' not selected').toBe('rgba(0, 0, 0, 0)');
  });

  test('TC-SUP-23: Empty "Create supplier" shows the required messages and sends nothing', async () => {
    await s.openAdd();
    await s.createButton.click();
    await expect(s.fixFieldsToast).toBeVisible();
    await expect(s.text('Name is required')).toBeVisible();
    await expect(s.text('Default currency is required')).toBeVisible();
    await expect(s.text('City is required')).toBeVisible();   // was "Choose a city." (BUG-44, fixed on the 21 Nov build)
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-24: Empty City message follows the standard "City is required"', async () => {
    // BUG-44 fixed on the stage build of 21 Nov 2026
    await s.openAdd();
    await s.createButton.click();
    await expect(s.text('City is required')).toBeVisible({ timeout: 5_000 });
  });

  test('TC-SUP-25: Name with only spaces is rejected', async () => {
    await s.openAdd();
    await s.name.fill('     ');
    await s.createButton.click();
    await expect(s.text('Name is required')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-26: Name keeps digits and special characters (e.g. "Hotel 7 & Spa (DXB)")', async () => {
    await s.openAdd();
    await s.name.pressSequentially('Hotel 7 & Spa (DXB)');
    await expect(s.name).toHaveValue('Hotel 7 & Spa (DXB)');
  });

  test('TC-SUP-27: Advance above 100% is not accepted', async () => {
    await s.openAdd();
    await s.fillRequired('QA Auto Supplier never saved');
    await s.advance.fill('150');
    await s.createButton.click();
    await expect(s.text("A percentage can't be more than 100")).toBeVisible();
    expect(blocked, 'an advance of 150% was sent to the server').toEqual([]);
  });

  test('TC-SUP-28: Negative Days for payment due is not accepted', async () => {
    await s.openAdd();
    await s.fillRequired('QA Auto Supplier never saved');
    await s.days.fill('-5');
    await s.createButton.click();
    await expect(s.fixFieldsToast).toBeVisible();
    expect(blocked, 'payment due of -5 days was sent to the server').toEqual([]);
  });

  test('TC-SUP-29: "Find a service" filters the service chips', async () => {
    await s.openAdd();
    await s.serviceSearch.fill('transfer');
    await expect(s.service('Private transfer')).toBeVisible();
    await expect(s.service('Shared transfer')).toBeVisible();
    await expect(s.service('Hotel')).toBeHidden();
  });

  test('TC-SUP-30: City list offers cities to pick (typed "Dub" -> Dubai)', async ({ page }) => {
    await s.openAdd();
    await s.city.fill('Dub');
    await expect(page.getByRole('option', { name: /Dubai/ }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-SUP-31: Default currency list offers active currencies (AED, USD)', async ({ page }) => {
    await s.openAdd();
    await s.currency.click();
    await expect(page.getByRole('option', { name: /AED/ }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('option', { name: /USD/ }).first()).toBeVisible();
  });

  test('TC-SUP-32: Cancel leaves the form without sending anything', async ({ page }) => {
    await s.openAdd();
    await s.name.fill('QA Auto Supplier never saved');
    await s.cancelButton.click();
    await page.waitForTimeout(2000);
    expect(blocked).toEqual([]);
    await expect(s.heading.or(page.getByText(/discard|unsaved/i)).first()).toBeVisible();
  });
});

// ======================= EXISTING SUPPLIER (read-only) =======================
test.describe('Existing supplier', () => {
  test('TC-SUP-40: Opening a supplier shows 5 tabs and a header with code, services and city', async ({ page }) => {
    await s.open();
    await s.openSupplier('Marina Bay Hotel');
    for (const t of ['Overview', 'Contacts', 'Products', 'Financials', 'Content'] as const) await expect(s.tab(t)).toBeVisible();
    await expect(page.locator('main :text("SUP-002"):visible').first()).toBeVisible();
    await expect(page).toHaveURL(/\/suppliers\/\d+\/overview$/);
  });

  test('TC-SUP-41: Overview is read-only until Edit; Code stays locked even in edit mode', async ({ page }) => {
    await s.open();
    await s.openSupplier('Marina Bay Hotel');
    const nameBox = page.locator('main input[placeholder="Supplier name"]:visible');
    const code = page.locator('main input[placeholder="Assigned when saved"]:visible');
    await expect(nameBox).toBeDisabled();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(nameBox).toBeEnabled();
    await expect(code).toBeDisabled();
    await expect(code).toHaveValue('SUP-002');
  });

  test('TC-SUP-42: In edit mode "Save" stays disabled until something changes; Cancel restores', async ({ page }) => {
    await s.open();
    await s.openSupplier('Marina Bay Hotel');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeDisabled();
    const nameBox = page.locator('main input[placeholder="Supplier name"]:visible');
    await nameBox.fill('Marina Bay Hotel CHANGED');
    await expect(save).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(nameBox).toHaveValue('Marina Bay Hotel');
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-43: Edit mode offers Approved / On Hold / Blocked status', async ({ page }) => {
    await s.open();
    await s.openSupplier('Marina Bay Hotel');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    for (const b of ['Approved', 'On hold', 'Blocked'] as const) await expect(s.statusButton(b)).toBeVisible();   // "On Hold" before BUG-45 was fixed
  });

  test('TC-SUP-44: Status is spelled the same in the list and on the supplier ("On hold")', async ({ page }) => {
    // BUG-45 fixed on the stage build of 21 Nov 2026
    await s.open();
    await s.openSupplier('Testing season 3');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(s.statusButton('On hold')).toBeVisible({ timeout: 5_000 });
  });

  test('TC-SUP-45: Header services match the Products tab', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await expect(page.locator('main :text("ABD-001 · Excursion, Hotel, Private transfer"):visible').first()).toBeVisible();
    await s.tab('Products').click();
    await expect(page.locator('main :text("3 products offered"):visible').first()).toBeVisible({ timeout: 30_000 });
    for (const p of ['Hotel', 'Excursion', 'Private transfer']) await expect(page.locator(`main :text-is("${p}"):visible`).first()).toBeVisible();
  });

  test('TC-SUP-46: Every supplier has a primary contact ("Testing season 3" has none)', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Contacts').click();
    await expect(page.locator('main :text("There are no records in Contacts"):visible'), 'the form itself says "A supplier must have a primary contact"').toHaveCount(0, { timeout: 30_000 });
  });

  test('TC-SUP-47: Add contact - Name and Role are required; first contact is Primary (locked)', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Contacts').click();
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = s.dialog('Add contact');
    await expect(d.getByText('A supplier must have a primary contact.', { exact: false })).toBeVisible();
    await expect(d.getByRole('switch').or(d.locator('input[type=checkbox]')).first()).toBeDisabled();
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d.getByText('Name is required')).toBeVisible();
    await expect(d.getByText('Role is required')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-48: Add contact - invalid email "abc" is rejected', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Contacts').click();
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = s.dialog('Add contact');
    await d.getByPlaceholder('Full name').fill('QA Auto Contact');
    await d.getByPlaceholder('Reservations, Sales, Accounts…').click();
    if (!(await page.getByRole('option').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) test.skip(true, 'DATA: no active Contact Type (role) in Core - reactivate one (question pending with the product owner)');
    await page.getByRole('option').first().click();
    await d.getByPlaceholder('name@company.com').fill('abc');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d.getByText(/valid email|email is invalid|invalid email/i)).toBeVisible();
    expect(blocked, 'a contact with email "abc" was sent').toEqual([]);
  });

  test('TC-SUP-49: Financials - currency table shows currency, payment due, advance, branch, bank accounts', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    for (const c of ['Currency', 'Payment due', 'Advance', 'Branch / department', 'Bank accounts'])
      await expect(page.getByRole('columnheader', { name: c })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main tbody tr:visible').filter({ hasText: 'AED' })).toContainText('30 days after invoice');
  });

  test('TC-SUP-50: Financials - Add currency: Currency is required', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = s.dialog('Add currency');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d.getByText('Currency is required')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-51: Financials - Add currency does not offer a currency the supplier already has (AED)', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = s.dialog('Add currency');
    await d.getByPlaceholder('Select a currency').click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('option', { name: /AED/ }), 'AED is already on this supplier').toHaveCount(0);
  });

  test('TC-SUP-52: Bank account - Account holder and Bank required, and an account number or IBAN', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: 'Add bank account' }).first().click();   // header and empty-state button
    const d = page.getByRole('dialog').last();
    await d.getByRole('button', { name: 'Save' }).click();
    for (const m of ['Account holder is required', 'Bank is required', 'Enter an account number or IBAN']) await expect(d.getByText(m)).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-SUP-53: Bank account - field limits (holder/bank 200, account/IBAN 50, SWIFT/sort code 30)', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: 'Add bank account' }).first().click();   // header and empty-state button
    const d = page.getByRole('dialog').last();
    await expect(d.getByPlaceholder('Name on the account')).toHaveAttribute('maxlength', '200');
    await expect(d.getByPlaceholder('Bank name')).toHaveAttribute('maxlength', '200');
    await expect(d.getByPlaceholder('IBAN, or IFSC for an Indian bank')).toHaveAttribute('maxlength', '50');
    await expect(d.getByPlaceholder('8 or 11 characters')).toHaveAttribute('maxlength', '30');
  });

  test('TC-SUP-54: Bank account - SWIFT code must be 8 or 11 characters ("ABC" rejected)', async ({ page }) => {
    test.fail(true, 'BUG: a 3-character SWIFT code is sent to the server, the screen shows no 8-or-11 message');
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await page.getByRole('button', { name: 'Add bank account' }).first().click();   // header and empty-state button
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Name on the account').fill('QA Auto Holder');
    await d.getByPlaceholder('Bank name').fill('QA Auto Bank');
    await d.getByPlaceholder('IBAN, or IFSC for an Indian bank').fill('AE070331234567890123456');
    await d.getByPlaceholder('8 or 11 characters').fill('ABC');
    await d.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(2000);
    expect(blocked, 'a SWIFT code of 3 characters was sent').toEqual([]);
    await expect(d.getByText(/8 or 11|SWIFT/i).filter({ hasNotText: 'SWIFT code' }).first()).toBeVisible();
  });

  test('TC-SUP-55: Tax fields limits: PAN 20, TAN 20, VAT 30', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Financials').click();
    await expect(page.locator('main input[placeholder="PAN number"]:visible')).toHaveAttribute('maxlength', '20', { timeout: 30_000 });
    await expect(page.locator('main input[placeholder="TAN number"]:visible')).toHaveAttribute('maxlength', '20');
    await expect(page.locator('main input[placeholder="VAT number"]:visible')).toHaveAttribute('maxlength', '30');
  });

  test('TC-SUP-56: Content tab - sections and "All changes saved" with Discard / Save changes', async ({ page }) => {
    await s.open();
    await s.openSupplier('Testing season 3');
    await s.tab('Content').click();
    await expect(page.locator('main :text("All changes saved"):visible').first()).toBeVisible({ timeout: 30_000 });
    for (const b of ['Discard', 'Save changes']) await expect(page.getByRole('button', { name: b })).toBeVisible();
    for (const sec of ['Overview', 'Description', 'Images', 'Property and rooms', 'Dining and recreation'])
      await expect(page.locator(`main :text-is("${sec}"):visible`).first()).toBeVisible();
  });

  test('TC-SUP-57: Audit history opens from the list', async ({ page }) => {
    await s.open();
    await s.auditButton.click();
    await expect(page.getByRole('dialog').or(page.getByRole('presentation')).last()).toContainText(/created|updated/i, { timeout: 30_000 });
  });
});
