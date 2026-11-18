import { test, expect } from '../../fixtures';
import { Page, Response } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage } from '../../pages/ContractPage';
import { waitForSave } from '../../pages/FormHelpers';

/*
 * SUPPLIER - Excursion / Private transfer contracts and allotments, and promotion details.
 * Part A: read-only (every save blocked).  Part B: REAL saves on "Testing season 3" -> Excursion only,
 * "QA Auto Contract <STAMP> excursion" is approved, then an allotment is added, and both are switched to Active = No.
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;

test.describe('Part A - excursion / transfer contract screens and promotion details (nothing is saved)', () => {
  let blocked: string[];
  let c: ContractPage;
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); c = new ContractPage(page); });

  for (const product of ['Excursion', 'Private transfer']) {
    test(`TC-EXC-01: ${product} contract - Rate basis, pax-band rates, cancellation; no base plan or seasons`, async ({ page }) => {
      await c.openAddContract(SUP, product);
      for (const s of ['Rate basis', 'Pax bands', 'Cancellation policy', 'Notes and terms', 'Contract file'])
        await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible();
      await expect(page.getByPlaceholder('Choose a base plan')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add season' })).toHaveCount(0);
      await expect(page.getByText('No rates yet. Add the first pax band.')).toBeVisible();
    });

    test(`TC-EXC-02: ${product} contract - empty Save shows "1 problem to fix" and sends nothing`, async ({ page }) => {
      await c.openAddContract(SUP, product);
      await c.saveButton.click();
      await expect(c.problems).toHaveText('1 problem to fix');
      await page.waitForTimeout(1500);
      expect(blocked).toEqual([]);
    });

    test(`TC-EXC-03: ${product} contract - "Add rate" adds a rate row (From, To, days, Product, Option, Pax, Adult, Child, Infant)`, async ({ page }) => {
      await c.openAddContract(SUP, product);
      await c.button('Add rate').click();
      for (const h of ['From', 'To', 'Valid days', 'Product', 'Option', 'Pax', 'Adult', 'Child', 'Infant'])
        await expect(page.locator(`main :text-is("${h}"):visible`).first(), h).toBeVisible();
      await expect(page.getByPlaceholder('All products').first()).toBeVisible();
      await expect(page.getByText(/1 rate/).first()).toBeVisible();
    });

    test(`TC-EXC-04: ${product} allotment form - same form as hotel (name, type, unit, dates, blocks, release)`, async ({ page }) => {
      await c.openProduct(SUP, product, 'Allotment');
      await c.button('Add allotment').click();
      for (const s of ['Allotment details', 'Inventory by date', 'Release'])
        await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible();
      await expect(page.getByText(/No blocks queued/)).toBeVisible();
    });
  }

  test('TC-EXC-10: Promotion - all 5 benefits can be switched on (Discount, Stay / pay, Meal upgrade, Room upgrade, FOC)', async ({ page }) => {
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    for (const s of ['Stay / pay', 'Meal upgrade', 'Room upgrade', 'Free of charge (FOC)']) await page.locator(`main input[aria-label="${s}"]`).first().click();
    await expect(page.getByText('Benefits').first().locator('xpath=..')).toContainText('5');
    await expect(page.getByText('Stay 3, 1 free').first()).toBeVisible();
    for (const h of ['Booked board', 'Booked room', 'Upgraded to', 'FOC on', 'Applied to'])
      await expect(page.locator(`main :text-is("${h}"):visible`).first(), h).toBeVisible();
  });

  test('TC-EXC-11: Promotion - Combinable switch and blackout rows (From, To, Rooms, Reason)', async ({ page }) => {
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    const comb = page.locator('main input[aria-label="Combinable"]').first();
    await expect(comb).not.toBeChecked();
    await comb.click();
    await expect(comb).toBeChecked();
    await c.button('Add blackout').click();
    await expect(page.getByText('1 blackout').first()).toBeVisible();
    await expect(page.getByPlaceholder('Reason').first()).toBeVisible();
  });

  test('TC-EXC-12: Promotion - early bird and last-minute fields are both offered in "Booking window & stay rules"', async ({ page }) => {
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    await expect(page.locator('main :text-is("Booking window & stay rules"):visible').first()).toBeVisible();
    for (const s of ['Sell from', 'Sell to', 'Early bird', 'Last minute', 'Min nights', 'Max nights', 'Check-in days'])
      await expect(page.locator('main :visible').getByText(s, { exact: false }).first(), s).toBeVisible();
  });
});

test.describe('Part B - excursion contract end to end (REAL saves on Testing season 3)', () => {
  test.describe.configure({ mode: 'serial' });
  const NAME = `QA Auto Contract ${STAMP} excursion`;
  let page: Page;
  let c: ContractPage;

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
      for (const sub of ['Allotment', 'Contract'] as const) {
        await c.openProduct(SUP, 'Excursion', sub);
        for (let i = 0; i < 8; i++) {
          const on = c.rows.filter({ hasText: /^QA Auto (Contract|Allotment)/ }).getByRole('switch', { checked: true });
          if (await on.count() === 0) break;
          await on.first().click();
          const d = page.getByRole('dialog').last();
          if (await d.isVisible({ timeout: 2500 }).catch(() => false)) await d.getByRole('button', { name: /Deactivate|Turn off|Yes|Confirm|Save/ }).last().click();
          await page.waitForTimeout(2500);
          await c.openProduct(SUP, 'Excursion', sub);
        }
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  const saved = (click: () => Promise<unknown>, what: RegExp) => waitForSave(page, click, what, { methods: ['POST', 'PUT'] });

  test(`TC-EXCC-01: Create "${NAME}" (AED, 1 pax-band rate: Jungle Safari, adult 100)`, async () => {
    await c.openAddContract(SUP, 'Excursion');
    await c.name.fill(NAME);
    await expect(page.locator('main input[value="Per person"]').first()).toBeVisible();   // rate basis default
    await c.pick(c.currency, /AED/);
    await c.priority.click(); await c.priority.press('Control+A'); await c.priority.pressSequentially(String(200 + Math.floor(Math.random() * 700))); await c.priority.press('Tab');
    await c.button('Add rate').click();
    const row = page.locator('main tbody tr:visible').filter({ has: page.getByPlaceholder('All products') }).last();
    await c.pick(row.getByPlaceholder('All products'), /Jungle Safari/);
    await page.keyboard.press('Escape');
    const adult = row.locator('input[type=number]').nth(2);                                // pax from, pax to, ADULT, child, infant
    await adult.click(); await adult.press('Control+A'); await adult.pressSequentially('100'); await adult.press('Tab');

    const r = await saved(() => c.saveButton.click(), /contracts/);
    const left = await c.problems.isVisible({ timeout: 2000 }).catch(() => false);
    expect(r?.ok(), `create failed (${r?.status()}) ${left ? await c.problems.innerText() : ''}`).toBe(true);
    await expect(c.saveButton).toBeHidden({ timeout: 60_000 });
    await expect(c.rows.filter({ hasText: NAME })).toContainText('Draft');
  });

  test('TC-EXCC-02: Approve the excursion contract -> Approved', async () => {
    await c.openProduct(SUP, 'Excursion', 'Contract');
    await c.rows.filter({ hasText: NAME }).getByRole('button', { name: `Approve ${NAME}` }).click();
    const d = page.getByRole('dialog').last();
    if (await d.isVisible({ timeout: 3000 }).catch(() => false)) await d.getByRole('button', { name: /Approve|Yes|Confirm/ }).last().click();
    await expect(c.rows.filter({ hasText: NAME })).toContainText('Approved', { timeout: 60_000 });
  });

  test('TC-EXCC-03: With an approved contract, an excursion allotment (5 a day) is saved', async () => {
    await c.openProduct(SUP, 'Excursion', 'Allotment');
    await c.button('Add allotment').click();
    await page.getByPlaceholder('Enter an allotment name').fill(`QA Auto Allotment ${STAMP} excursion`);
    const unit = page.getByPlaceholder('Choose a unit');
    if (await unit.count()) await c.pick(unit, /./);
    if (await page.getByText(/No blocks queued/).count()) await c.button('Add block').click();
    const units = page.locator('main input[type=number]:visible').first();
    await units.click(); await units.press('Control+A'); await units.pressSequentially('5'); await units.press('Tab');
    const r = await saved(() => c.saveButton.click(), /allotments/);
    expect(r?.ok(), `allotment failed ${r?.status()}`).toBe(true);
    await c.openProduct(SUP, 'Excursion', 'Allotment');
    await expect(c.rows.filter({ hasText: `QA Auto Allotment ${STAMP} excursion` })).toHaveCount(1);
  });
});
