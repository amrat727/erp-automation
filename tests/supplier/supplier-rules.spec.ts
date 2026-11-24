import { test, expect } from '../../fixtures';
import { columnFilter } from '../../pages/SupplierPage';
import { Page, Response } from '@playwright/test';
import { ContractPage } from '../../pages/ContractPage';

/*
 * SUPPLIER BUSINESS RULES - confirmed by the product owner on 16-Nov-2026 (reports/Supplier-Questions).
 *   Q-01  Blocked supplier = deactivated: NO new detail can be saved.  On hold supplier: details can be edited.
 *   Q-06  Removing a currency that a contract uses -> popup "a contract uses this currency" and the contract moves to Provisional.
 *   Q-16  Two contracts with the SAME priority must not be saved.
 * REAL saves, only on test data:
 *   - blocked supplier = a "QA Auto Supplier ..." that the supplier tests already set to Blocked (any change is undone)
 *   - contracts "QA Auto Contract <STAMP> ..." on "Testing season 3" -> always switched to Active = No at the end
 *   - currency USD is added to "Testing season 3" for Q-06 and removed again by the test itself
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;                                  // Testing season 3 (On hold)
// a priority no other contract uses - built from the run tag so every worker computes the same number
const PRIO = String(20 + (Number(STAMP.split('').map(ch => 'KLMNPQRSTV'.indexOf(ch)).join('')) % 70));

// not serial: one rule failing must not skip the others (the file still runs in order with 1 worker)
test.describe.configure({ mode: 'default' });
test.describe('Supplier business rules', () => {
  let page: Page;
  let c: ContractPage;
  let blockedUrl = '';

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    c = new ContractPage(page);
  });

  test.afterAll(async () => {
    test.setTimeout(300_000);
    try {
      // every QA contract of this run -> Active = No
      await c.openProduct(SUP, 'Hotel', 'Contract');
      for (let i = 0; i < 6; i++) {
        const on = c.rows.filter({ hasText: /^QA Auto Contract/ }).getByRole('switch', { checked: true });
        if (await on.count() === 0) break;
        await on.first().click();
        const d = page.getByRole('dialog').last();
        if (await d.isVisible({ timeout: 3000 }).catch(() => false)) await d.getByRole('button', { name: /Deactivate|Turn off|Yes|Confirm|Save/ }).last().click();
        await page.waitForTimeout(2500);
        await c.openProduct(SUP, 'Hotel', 'Contract');
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  /** wait for the next write request to the server and return it (or null when the screen sent nothing) */
  const nextWrite = (what: RegExp, ms = 15_000) => page.waitForResponse(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.request().method()) && what.test(r.url()), { timeout: ms }).catch(() => null as Response | null);

  const openBlocked = async (tab = 'overview') => {
    if (!blockedUrl) {
      await page.goto('/suppliers');
      await (await columnFilter(page, /^Name/)).fill('QA Auto Supplier');
      const row = page.locator('main tbody tr:visible', { hasText: 'Blocked' }).first();
      await expect(row).toBeVisible({ timeout: 90_000 });
      await row.locator('td').first().click();
      await expect(page.getByRole('tab', { name: 'Overview' }).first()).toBeVisible({ timeout: 60_000 });
      blockedUrl = page.url().replace(/\/overview.*/, '');
    }
    await page.goto(`${blockedUrl}/${tab}`);
    await expect(page.getByRole('tab', { name: 'Overview' }).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('main').getByText('Blocked').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(2000);
  };

  // ---------------- Q-01 ----------------
  test('TC-RULE-01: Blocked supplier - its details cannot be edited and saved', async () => {
    // BUG-51 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a Blocked supplier can still be edited - the server saves it (PUT /suppliers/<id> -> 204)')
    await openBlocked();
    const edit = page.getByRole('button', { name: 'Edit', exact: true }).first();
    if (!(await edit.isVisible()) || await edit.isDisabled()) return;            // expected: no editing at all
    await edit.click();
    const name = page.locator('main input:visible').filter({ hasNot: page.locator('[placeholder="Search"]') }).nth(3);
    const nameInput = page.getByPlaceholder(/supplier name/i).first();
    const field = (await nameInput.count()) ? nameInput : name;
    if (await field.isDisabled()) return;                                         // 21 Nov build: the fields of a Blocked supplier are locked
    const old = await field.inputValue();
    await field.fill(`${old} x`);
    const w = nextWrite(/suppliers\/\d+$/);
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    const r = await w;
    try {
      expect(r === null || !r.ok(), `a BLOCKED supplier was saved (${r?.request().method()} ${r?.url()} -> ${r?.status()})`).toBe(true);
    } finally {
      if (r?.ok()) {   // undo the change on the test supplier
        await openBlocked();
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        await field.fill(old);
        await page.getByRole('button', { name: 'Save', exact: true }).last().click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('TC-RULE-02: Blocked supplier - a new contact cannot be added', async () => {
    // BUG-52 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a contact can still be added to a Blocked supplier (POST .../contacts -> 201)')
    await openBlocked('contacts');
    const add = page.getByRole('button', { name: /Add contact$/ }).last();
    if (!(await add.isVisible()) || await add.isDisabled()) return;
    await add.click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Full name').fill(`QA Auto Contact ${STAMP} blocked`);
    await c.pick(d.getByPlaceholder('Reservations, Sales, Accounts…'), /./);
    const w = nextWrite(/contacts/);
    await d.getByRole('button', { name: 'Save' }).click();
    const r = await w;
    expect(r === null || !r.ok(), `a contact was added to a BLOCKED supplier (${r?.status()})`).toBe(true);
  });

  test('TC-RULE-03: Blocked supplier - a new currency cannot be added', async () => {
    // BUG-53 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a currency can still be added to a Blocked supplier (POST .../currencies -> 204)')
    await openBlocked('financials');
    const add = page.getByRole('button', { name: /Add currency$/i }).last();
    if (!(await add.isVisible()) || await add.isDisabled()) return;
    await add.click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Select a currency').fill('USD');
    await page.getByRole('option', { name: /USD/ }).first().click();
    const w = nextWrite(/currencies/);
    await d.getByRole('button', { name: 'Save' }).click();
    const r = await w;
    try {
      expect(r === null || !r.ok(), `a currency was added to a BLOCKED supplier (${r?.status()})`).toBe(true);
    } finally {
      if (r?.ok()) {   // undo
        await openBlocked('financials');
        const rm = page.getByRole('button', { name: 'Remove USD' });
        if (await rm.isEnabled().catch(() => false)) {
          await rm.click();
          const cd = page.getByRole('dialog').last();
          if (await cd.isVisible({ timeout: 3000 }).catch(() => false)) await cd.getByRole('button', { name: /Remove|Delete|Yes|Confirm/ }).last().click();
          await page.waitForTimeout(3000);
        }
      }
    }
  });

  test('TC-RULE-04: On hold supplier - details can be edited (Save becomes available after a change)', async () => {
    await page.goto(`/suppliers/${SUP}/overview`);
    await expect(page.locator('main').getByText('On hold').first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const save = page.getByRole('button', { name: 'Save', exact: true }).last();
    await expect(save).toBeDisabled();
    const anyText = page.locator('main input[type=text]:visible:not([disabled]):not([placeholder="Search"])').first();
    await anyText.fill((await anyText.inputValue()) + ' ');
    await expect(save).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();   // nothing is saved
  });

  // ---------------- Q-16 ----------------
  const createContract = async (name: string, currency: RegExp, priority: string) => {
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill(name);
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, currency);
    await c.priority.click();
    await c.priority.press('Control+A');
    await c.priority.pressSequentially(priority);
    await c.priority.press('Tab');
    await c.addSeason('QA Season');
    for (const p of ['Club Single', 'Club Double', 'Family Single', 'Family Double']) await c.setPrice(p, 'QA Season', '300');
    const w = nextWrite(/\/contracts/, 60_000);
    await c.saveButton.click();
    return w;
  };

  test(`TC-RULE-10: A first contract with priority ${PRIO} is saved`, async () => {
    const r = await createContract(`QA Auto Contract ${STAMP} prio A`, /AED/, PRIO);
    expect(r?.ok(), `create failed: ${r?.status()}`).toBe(true);
    await expect(c.saveButton).toBeHidden({ timeout: 60_000 });
  });

  test(`TC-RULE-11: A second contract for the same dates with the SAME priority ${PRIO} is refused`, async () => {
    test.fail(true, 'BUG: a second contract for the same product and dates with the same priority is saved');
    const r = await createContract(`QA Auto Contract ${STAMP} prio B`, /AED/, PRIO);
    await page.waitForTimeout(2000);
    expect(r === null || !r.ok(), 'a second contract with the same priority was saved').toBe(true);
    await expect(page.getByText(/priority/i).filter({ hasText: /already|same|another|used/i }).first(), 'message about the priority').toBeVisible();
  });

  // ---------------- Q-06 ----------------
  const NAME_USD = `QA Auto Contract ${STAMP} USD`;
  test('TC-RULE-20: Add USD to "Testing season 3" and create + approve a USD contract', async () => {
    await page.goto(`/suppliers/${SUP}/financials`);
    await expect(page.getByRole('button', { name: /Add currency$/i }).last()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2000);
    if (!(await page.getByRole('button', { name: 'Remove USD' }).count())) {
      await page.getByRole('button', { name: /Add currency$/i }).last().click();
      const d = page.getByRole('dialog').last();
      await d.getByPlaceholder('Select a currency').fill('USD');
      await page.getByRole('option', { name: /USD/ }).first().click();
      await d.getByPlaceholder('Number of days').fill('30');
      const w = nextWrite(/currencies/, 60_000);
      await d.getByRole('button', { name: 'Save' }).click();
      expect((await w)?.ok(), 'adding USD failed').toBe(true);
    }
    const r = await createContract(NAME_USD, /USD/, String(Number(PRIO) + 1));
    expect(r?.ok(), `create failed: ${r?.status()}`).toBe(true);
    await expect(c.saveButton).toBeHidden({ timeout: 60_000 });
    await c.rows.filter({ hasText: NAME_USD }).getByRole('button', { name: `Approve ${NAME_USD}` }).click();
    const cd = page.getByRole('dialog').last();
    if (await cd.isVisible({ timeout: 3000 }).catch(() => false)) await cd.getByRole('button', { name: /Approve|Yes|Confirm/ }).last().click();
    await expect(c.rows.filter({ hasText: NAME_USD })).toContainText('Approved', { timeout: 60_000 });
  });

  test('TC-RULE-21: Removing USD shows a popup that a contract uses it', async () => {
    await page.goto(`/suppliers/${SUP}/financials`);
    const rm = page.getByRole('button', { name: 'Remove USD' });
    await expect(rm).toBeVisible({ timeout: 90_000 });
    await expect(rm, '"Remove USD" is disabled').toBeEnabled();
    await rm.click();
    const d = page.getByRole('dialog').last();
    await expect(d, 'no popup when removing a currency that a contract uses').toBeVisible({ timeout: 10_000 });
    console.log('POPUP: ' + (await d.innerText()).replace(/\s+/g, ' '));
    await expect(d).toContainText('USD is used by contracts');
    await expect(d).toContainText('1 active contract is priced in USD');
    await d.getByRole('button', { name: 'Remove anyway' }).click();
    await expect(page.getByRole('button', { name: 'Remove USD' })).toHaveCount(0, { timeout: 30_000 });
  });

  test('TC-RULE-22: After removing USD, the USD contract is Provisional (no bookings possible)', async () => {
    test.fail(true, 'BUG: the contract that uses the removed currency stays "Approved" - it should move to Provisional');
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await expect(c.rows.filter({ hasText: NAME_USD })).toContainText('Provisional');
  });
});
