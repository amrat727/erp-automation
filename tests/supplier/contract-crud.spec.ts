import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { ContractPage, ContractsListPage } from '../../pages/ContractPage';

/*
 * SUPPLIER CONTRACT - end-to-end data flow (REAL saves - approved by the product owner on 16-Nov-2026).
 * Works ONLY on supplier 18 "Testing season 3" -> Hotel (rooms Club and Family).
 * Creates "QA Auto Contract <STAMP>", "QA Auto Allotment <STAMP>" and "QA Auto Promotion <STAMP>".
 * The afterAll ALWAYS switches every one of them to Active = No (inactive records price nothing).
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;
const NAME = `QA Auto Contract ${STAMP}`;
const RENAMED = `${NAME} edited`;
const CODE = `QA-${STAMP}`;
const ALLOT = `QA Auto Allotment ${STAMP}`;
const PROMO = `QA Auto Promotion ${STAMP}`;
const PRICES: [string, string][] = [['Club Single', '400'], ['Club Double', '500'], ['Family Single', '450'], ['Family Double', '550']];

test.describe.configure({ mode: 'serial' });
test.describe('Supplier contract: end-to-end data flow', () => {
  let page: Page;
  let c: ContractPage;
  let current = NAME;

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    c = new ContractPage(page);
  });

  /** Switch the "Active" switch off (in the list) on every record of this run on one sub-tab */
  const deactivateAll = async (sub: 'Contract' | 'Allotment' | 'Promotions') => {
    await c.openProduct(SUP, 'Hotel', sub);
    for (let i = 0; i < 6; i++) {
      const on = c.rows.filter({ hasText: /^QA Auto (Contract|Allotment|Promotion)/ }).getByRole('switch', { checked: true });
      if (await on.count() === 0) return;
      const label = (await on.first().locator('xpath=ancestor::tr[1]').locator('td').first().innerText()).split('\n')[0];
      await on.first().click();
      const d = page.getByRole('dialog').last();
      if (await d.isVisible({ timeout: 3000 }).catch(() => false)) await d.getByRole('button', { name: /Deactivate|Turn off|Yes|Confirm|Save/ }).last().click();
      await page.waitForTimeout(2500);
      console.log(`cleanup: ${sub} "${label}" -> Active = No`);
      await c.openProduct(SUP, 'Hotel', sub);
    }
  };

  /** Wait for a save to reach the server and the editor to close (the app goes back to the list) */
  const saved = async (what: RegExp) => {
    const res = page.waitForResponse(r => ['POST', 'PUT', 'PATCH'].includes(r.request().method()) && what.test(r.url()), { timeout: 60_000 });
    await c.saveButton.click();
    const draft = page.getByRole('dialog').filter({ hasText: /return to Draft/ });
    if (await draft.isVisible({ timeout: 2500 }).catch(() => false)) await draft.getByRole('button', { name: 'Save' }).click();
    const r = await res;
    console.log(`SAVE ${r.request().method()} ${r.url()}\n${(r.request().postData() || '').slice(0, 1500)}`);
    expect(r.ok(), `save failed: ${r.status()} ${await r.text().catch(() => '')}`).toBe(true);
    await expect(c.saveButton).toBeHidden({ timeout: 60_000 });
  };
  test.afterAll(async () => {
    test.setTimeout(400_000);
    try {
      for (const sub of ['Promotions', 'Allotment', 'Contract'] as const) await deactivateAll(sub).catch(e => console.log(`cleanup ${sub} failed: ${e}`));
    } finally { await page.close(); }
  });

  /** the contract row whose name is exactly `n` */
  const exact = (n: string) => c.rows.filter({ has: page.locator('td:first-child p').getByText(n, { exact: true }) });

  const openMine = async () => {
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await c.rows.filter({ hasText: current }).first().locator('td').first().click();
    await expect(c.name).toHaveValue(current, { timeout: 60_000 });
  };

  test(`TC-CONC-01: Create "${NAME}" (BB, AED, 1 season, 4 prices) -> saved as Draft`, async () => {
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill(NAME);
    await c.code.fill(CODE);
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.priority.fill('1');
    await c.addSeason('QA Season');
    for (const [room, p] of PRICES) await c.setPrice(room, 'QA Season', p);
    await expect(page.getByText(/prices? (is|are) missing/)).toBeHidden();
    await saved(/\/contracts/);
    await expect(exact(NAME)).toContainText('Draft');
  });

  test('TC-CONC-02: The contract is in the product\'s contract list: code, 4 rates, Draft, Active', async () => {
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const row = exact(NAME);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(CODE);
    await expect(row).toContainText('4 rates');
    await expect(row).toContainText('Draft');
    await expect(row.getByRole('switch', { name: 'Active' })).toBeChecked();
  });

  test('TC-CONC-03: The contract is in the global Contracts list under "Testing season 3"', async () => {
    const l = new ContractsListPage(page);
    await l.open();
    await l.search.fill(CODE);
    await expect(l.rows).toHaveCount(1, { timeout: 30_000 });
    await expect(l.rows.first()).toContainText(NAME);
    await expect(l.rows.first()).toContainText('Testing season 3');
    await expect(l.rows.first()).toContainText('Draft');
  });

  test('TC-CONC-04: Re-opened, the contract shows every saved value', async () => {
    await openMine();
    await expect(c.code).toHaveValue(CODE);
    await expect(c.basePlan).toHaveValue('Bed and breakfast');
    await expect(c.currency).toHaveValue(/AED/);
    await expect(c.priority).toHaveValue('1');
    for (const [room, p] of PRICES) await expect(c.price(room, 'QA Season'), room).toHaveValue(new RegExp(`^${p}(\\.00)?$`));
  });

  test('TC-CONC-05: Rename + change a price -> saved; the list shows the new name', async () => {
    await openMine();
    await c.name.fill(RENAMED);
    await c.setPrice('Club Single', 'QA Season', '420');
    await saved(/\/contracts/);
    current = RENAMED;
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await expect(exact(RENAMED)).toHaveCount(1);
    await openMine();
    await expect(c.price('Club Single', 'QA Season')).toHaveValue(/^420/);
  });

  test('TC-CONC-06: A cancellation band is saved', async () => {
    await openMine();
    await c.button('Add cancellation policy').click();
    const value = page.locator('main input[type=number]:visible').last();
    await expect(value).toBeVisible();
    await value.fill('100');
    await saved(/\/contracts/);
    await openMine();
    await expect(page.getByText(/1 band/).first()).toBeVisible();
  });

  test('TC-CONC-07: Approve the contract -> status Approved', async () => {
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await c.rows.filter({ hasText: RENAMED }).getByRole('button', { name: `Approve ${RENAMED}` }).click();
    const confirm = page.getByRole('dialog').last();
    if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) await confirm.getByRole('button', { name: /Approve|Yes|Confirm/ }).last().click();
    await expect(c.rows.filter({ hasText: RENAMED })).toContainText('Approved', { timeout: 60_000 });
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await expect(c.rows.filter({ hasText: RENAMED })).toContainText('Approved');
  });

  test('TC-CONC-08: Rate check prices a Club stay from this contract', async () => {
    test.skip(true, 'Rate check is out of scope for now (product owner, 16-Nov-2026)');
    await c.openProduct(SUP, 'Hotel', 'Rate check');
    const quote = page.waitForResponse(r => /rate-quote/.test(r.url()), { timeout: 60_000 });
    await c.button('Check rate').click();
    const res = await quote;
    expect(res.ok()).toBe(true);
    await expect(page.locator('main').getByText(/AED/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('main').getByText(new RegExp(`${CODE}|${RENAMED.replace(/[()]/g, '.')}`)).first()).toBeVisible();
  });

  test(`TC-CONC-10: Create allotment "${ALLOT}" (Guaranteed, Club, 5 rooms a day)`, async () => {
    await c.openProduct(SUP, 'Hotel', 'Allotment');
    await c.button('Add allotment').click();
    await page.getByPlaceholder('Enter an allotment name').fill(ALLOT);
    // with an approved contract the form pre-selects EVERY room and adds block 1 itself -> make the Rooms field exactly [Club]
    await page.waitForTimeout(1500);
    const roomsBox = page.locator('main :text-is("Rooms"):visible').first().locator('xpath=following::div[contains(@class,"MuiAutocomplete-root") or contains(@class,"MuiFormControl-root")][1]');
    const chip = (n: string) => roomsBox.locator('.MuiChip-root', { hasText: n });
    if (await chip('Family').count()) await chip('Family').locator('svg').click();
    if (!(await chip('Club').count())) await c.pick(roomsBox.locator('input').first(), 'Club');
    await page.keyboard.press('Escape');
    await expect(chip('Club')).toHaveCount(1);
    await expect(chip('Family')).toHaveCount(0);
    if (await c.table.locator('tbody tr').count() === 0) await c.button('Add block').click();
    const units = c.table.locator('tbody tr').first().locator('input[type=number]').first();   // "Units" of block 1
    await units.click();
    await units.press('Control+A');
    await units.pressSequentially('5');
    await units.press('Tab');
    await page.screenshot({ path: 'test-results-contract-crud/allotment-before-save.png', fullPage: true });
    await saved(/allotment/i);
    await c.openProduct(SUP, 'Hotel', 'Allotment');
    const row = c.rows.filter({ hasText: ALLOT });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Guaranteed');
    await expect(row).toContainText('Club');
    await expect(row).not.toContainText('0 of 0');   // 5 rooms a day were loaded
  });

  test(`TC-CONC-11: Create promotion "${PROMO}" (10% discount, AED)`, async () => {
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    await page.getByPlaceholder('Promotion name').fill(PROMO);
    await c.pick(page.getByPlaceholder('Choose a currency').first(), /AED/);
    const pct = page.locator('main input[type=number]:visible').nth(5);
    await pct.click();
    await pct.press('Control+A');
    await pct.pressSequentially('10');
    await pct.press('Tab');
    await saved(/promotion/i);
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await expect(c.rows.filter({ hasText: PROMO })).toHaveCount(1);
  });

  test('TC-CONC-20: Cleanup - every record of this run is switched to Active = No', async () => {
    test.setTimeout(400_000);
    for (const sub of ['Promotions', 'Allotment', 'Contract'] as const) await deactivateAll(sub);
    for (const sub of ['Promotions', 'Allotment', 'Contract'] as const) {
      await c.openProduct(SUP, 'Hotel', sub);
      await expect(c.rows.filter({ hasText: /^QA Auto (Contract|Allotment|Promotion)/ }).getByRole('switch', { checked: true }), sub).toHaveCount(0);
    }
  });
});
