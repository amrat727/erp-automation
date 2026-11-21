import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { SupplierPage } from '../../pages/SupplierPage';

/*
 * SUPPLIER - end-to-end data flow (REAL saves - approved by the product owner on 13-Nov-2026).
 * Creates ONE supplier "QA Auto Supplier <STAMP>" and changes ONLY that supplier.
 * The last step ALWAYS sets it to "Blocked" (there is no Active switch on suppliers).
 * Steps run in order and share the same browser page.
 */
const STAMP = process.env.RUN_STAMP!;
const NAME = `QA Auto Supplier ${STAMP}`;
const RENAMED = `${NAME} edited`;

test.describe.configure({ mode: 'serial' });
test.describe('Supplier: end-to-end data flow', () => {
  let page: Page;
  let s: SupplierPage;
  let supplierUrl = '';
  let current = NAME;

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    s = new SupplierPage(page);
  });
  // ALWAYS runs (even when a step failed): every supplier of this run ends up Blocked
  test.afterAll(async () => {
    test.setTimeout(300_000);
    try {
      await s.open();
      await s.search(NAME);
      const handled = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const open = s.rows.filter({ hasText: STAMP }).filter({ hasNot: page.locator('td:nth-child(3):text-is("Blocked")') });
        if (await open.count() === 0) break;
        const name = (await open.first().locator('td').first().innerText()).trim();
        if (handled.has(name)) break;   // already handled: stop instead of looping on a stale list
        handled.add(name);
        await open.first().locator('td').first().click();
        await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await s.statusButton('Blocked').click();
        const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
        if (await saveBtn.isEnabled()) await saveBtn.click();   // disabled = it is already Blocked
        await page.waitForTimeout(3000);
        console.log(`cleanup: "${name}" set to Blocked`);
        await s.open();
        await s.search(NAME);
      }
    } finally { await page.close(); }
  });

  const openMine = async () => {
    if (supplierUrl) {
      await page.goto(supplierUrl);
      await expect(s.tab('Overview')).toBeVisible({ timeout: 90_000 });
    } else { await s.open(); await s.openSupplier(current); }
  };
  const edit = async () => page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  const save = () => page.getByRole('button', { name: 'Save', exact: true });

  test(`TC-SUPC-01: Create "${NAME}" (Dubai, AED, Approved, Hotel) -> success and a code is assigned`, async () => {
    await s.openAdd();
    await s.fillRequired(NAME, 'Dubai', 'AED');
    await s.statusButton('Approved').click();
    await s.service('Hotel').click();
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /supplier/i.test(r.url()), { timeout: 60_000 });
    await s.createButton.click();
    expect((await res).ok(), 'create request failed').toBe(true);
    await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
    supplierUrl = page.url().replace(/\/[a-z]+$/, '/overview');
    await expect(page.locator('main input[placeholder="Assigned when saved"]:visible')).not.toHaveValue('', { timeout: 30_000 });
  });

  test('TC-SUPC-02: The new supplier is in the list with its code and status "Approved"', async () => {
    await s.open();
    await s.search(NAME);
    const row = s.rows.filter({ hasText: NAME });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').nth(1)).not.toHaveText('');
    await expect(row).toContainText('Approved');   // the Status column moved when City was added
  });

  test('TC-SUPC-03: The saved values are shown on Overview and Financials', async () => {
    await openMine();
    await expect(page.locator('main input[placeholder="Supplier name"]:visible')).toHaveValue(NAME);
    await expect(page.locator('main input[placeholder="Search cities"]:visible')).toHaveValue(/Dubai/);
    await s.tab('Financials').click();
    await expect(page.locator('main tbody tr:visible').filter({ hasText: 'AED' })).toContainText('30 days after invoice', { timeout: 30_000 });
  });

  test('TC-SUPC-05: Rename -> saved; the list shows the new name', async () => {
    await openMine();
    await edit();
    await expect(save()).toBeDisabled();
    await page.locator('main input[placeholder="Supplier name"]:visible').fill(RENAMED);
    await expect(save()).toBeEnabled();
    const res = page.waitForResponse(r => ['PUT', 'POST', 'PATCH'].includes(r.request().method()) && /supplier/i.test(r.url()), { timeout: 60_000 });
    await save().click();
    expect((await res).ok()).toBe(true);
    current = RENAMED;
    await s.open();
    await s.search(RENAMED);
    await expect(s.rows.filter({ hasText: RENAMED })).toHaveCount(1);
  });

  test('TC-SUPC-06: Add the first contact -> it becomes the primary contact', async () => {
    await openMine();
    await s.tab('Contacts').click();
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = s.dialog('Add contact');
    await d.getByPlaceholder('Full name').fill('QA Auto Contact One');
    await d.getByPlaceholder('Reservations, Sales, Accounts…').click();
    if (!(await page.getByRole('option').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) test.skip(true, 'DATA: no active Contact Type (role) in Core - reactivate one (question pending with the product owner)');
    await page.getByRole('option').first().click();
    await d.getByPlaceholder('name@company.com').fill('qa.one@example.com');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden({ timeout: 30_000 });
    const row = page.locator('main :visible').getByText('QA Auto Contact One').first();
    await expect(row).toBeVisible();
    await expect(page.locator('main :visible').getByText(/primary/i).first()).toBeVisible();
  });

  test('TC-SUPC-07: Add a second contact -> both are listed, only ONE is primary', async () => {
    await openMine();
    await s.tab('Contacts').click();
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = s.dialog('Add contact');
    await d.getByPlaceholder('Full name').fill('QA Auto Contact Two');
    await d.getByPlaceholder('Reservations, Sales, Accounts…').click();
    if (!(await page.getByRole('option').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) test.skip(true, 'DATA: no active Contact Type (role) in Core - reactivate one (question pending with the product owner)');
    await page.getByRole('option').first().click();   // only one role ("Admin") exists in this company
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden({ timeout: 30_000 });
    for (const c of ['QA Auto Contact One', 'QA Auto Contact Two']) await expect(page.locator('main :visible').getByText(c).first()).toBeVisible();
    await expect(page.locator('main :visible').getByText(/^Primary$/i), 'only ONE contact may be primary').toHaveCount(1);
  });

  test('TC-SUPC-08: Add currency USD with payment due 15 days -> new row "15 days after invoice"', async () => {
    await openMine();
    await s.tab('Financials').click();
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = s.dialog('Add currency');
    await d.getByPlaceholder('Select a currency').fill('USD');
    await page.getByRole('option', { name: /USD/ }).first().click();
    await d.getByPlaceholder('Number of days').fill('15');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('main tbody tr:visible').filter({ hasText: 'USD' })).toContainText('15 days after invoice');
  });

  test('TC-SUPC-09: Add a bank account (IBAN + 8-character SWIFT) to AED -> shown on the currency row', async () => {
    await openMine();
    await s.tab('Financials').click();
    await page.getByRole('button', { name: 'Add bank account' }).first().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Name on the account').fill('QA Auto Holder');
    await d.getByPlaceholder('Bank name').fill('QA Auto Bank');
    await d.getByPlaceholder('IBAN, or IFSC for an Indian bank').fill('AE070331234567890123456');
    await d.getByPlaceholder('8 or 11 characters').fill('QAAUAEAD');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden({ timeout: 30_000 });
    await expect(page.locator('main tbody tr:visible').filter({ hasText: 'AED' })).toContainText('QA Auto Bank');   // ("—" is the empty Branch/department cell)
  });

  test('TC-SUPC-10: Status "On Hold" -> list shows "On hold" and the On hold filter finds it', async () => {
    await openMine();
    await edit();
    await s.statusButton('On Hold').click();
    await save().click();
    await page.waitForTimeout(3000);
    await s.open();
    await s.filterStatus('On hold');
    await s.search(current);
    await expect(s.rows.filter({ hasText: current })).toHaveCount(1);
  });

  test('TC-SUPC-11: Audit history of the list mentions this supplier', async () => {
    await s.open();
    await s.auditButton.click();
    await expect(page.getByText(new RegExp(STAMP)).first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
  });

  // Duplicates last: a duplicate bug must not stop the other steps (serial mode skips everything after a failure)
  for (const [label, variant] of [['the SAME name', (n: string) => n], ['the same name in CAPITALS', (n: string) => n.toUpperCase()], ['the same name with spaces around it', (n: string) => `   ${n}   `]] as const) {
    test(`TC-SUPC-12: Creating ${label} again is rejected`, async () => {
      test.fail(true, 'BUG: the app saves a second supplier with an existing name (the test blocks the copy at once)');
      const typed = variant(current);
      await s.openAdd();
      await s.fillRequired(typed, 'Dubai', 'AED');
      const res = page.waitForResponse(r => r.request().method() === 'POST' && /supplier/i.test(r.url()), { timeout: 60_000 }).catch(() => null);
      await s.createButton.click();
      const r = await res;
      if (r?.ok()) {   // it was saved -> block the copy at once so it does not stay usable, then fail
        await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
        await edit(); await s.statusButton('Blocked').click(); await save().click();
        await page.waitForTimeout(3000);
      }
      expect(r?.ok() ?? false, `duplicate supplier "${typed}" was SAVED (the copy has been set to Blocked)`).toBe(false);
      await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible();
    });
  }

  test('TC-SUPC-13: Cleanup - set the supplier to "Blocked"; the Blocked filter finds it', async () => {
    await openMine();
    await edit();
    await s.statusButton('Blocked').click();
    await save().click();
    await page.waitForTimeout(3000);
    await s.open();
    await s.filterStatus('Blocked');
    await s.search(current);
    // the duplicate-name bug (BUG-43) can leave copies with the same name: every one of them must be Blocked
    const mine = s.rows.filter({ hasText: current });
    await expect(mine.first()).toBeVisible();
    for (const r of await mine.all()) await expect(r).toContainText('Blocked');
  });
});
