import { test, expect } from '../../fixtures';
import { columnFilter } from '../../pages/SupplierPage';
import { Page, Response } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage } from '../../pages/ContractPage';

/*
 * SUPPLIER BUSINESS RULES - round 2: the product owner's answers in reports/Supplier-Questions/Supplier-Questions.ods (17-Nov-2026).
 * Part A (read-only, every save BLOCKED): what the screen offers or sends.  A request that reaches the network = the screen let it through.
 * Part B (REAL saves, only "QA Auto ..." test data on "Testing season 3"): rules only the server can decide.
 *         Every contract / allotment / promotion of this run is switched to Active = No in afterAll.
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;                       // Testing season 3 (On hold, Hotel rooms Club + Family, currency AED)
const ROOMS = ['Club Single', 'Club Double', 'Family Single', 'Family Double'];

/** wait for the next write request (null = the screen sent nothing) */
const nextWrite = (page: Page, what: RegExp, ms = 12_000) =>
  page.waitForRequest(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method()) && what.test(r.url()), { timeout: ms }).catch(() => null);

// =====================================================================================================================
test.describe('Part A - supplier screens (nothing is saved)', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

  const openBlockedSupplier = async (page: Page) => {
    await page.goto('/suppliers');
    await (await columnFilter(page, /^Name/)).fill('QA Auto Supplier');
    const row = page.locator('main tbody tr:visible', { hasText: 'Blocked' }).first();
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.locator('td').first().click();
    await expect(page.getByRole('tab', { name: 'Overview' }).first()).toBeVisible({ timeout: 60_000 });
  };

  test('TC-R2-01: A Blocked supplier cannot be moved back to "On hold" (only to Approved)', async ({ page }) => {
    // BUG-56 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a Blocked supplier still offers "On Hold" in Edit')
    await openBlockedSupplier(page);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const onHold = page.getByRole('button', { name: 'On Hold', exact: true });
    expect(await onHold.count() === 0 || await onHold.isDisabled(), '"On Hold" is offered on a Blocked supplier').toBe(true);
  });

  test('TC-R2-02: The city of a supplier cannot be changed after it is created', async ({ page }) => {
    // BUG-57 fixed on the stage build of 21 Nov 2026 (was: 'BUG: in Edit mode the supplier City ("Search cities") is still editable - the city must be fixed after creation')
    await page.goto(`/suppliers/${SUP}/overview`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const city = page.getByPlaceholder('Search cities').first();       // in the (collapsed) Location section
    await expect(city).toHaveValue('Abu Dhabi', { timeout: 30_000 });
    expect(await city.isDisabled(), 'City is editable in Edit mode').toBe(true);
  });

  test('TC-R2-03: Payment due above 365 days is not accepted', async ({ page }) => {
    // BUG-58 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a payment due of 366 days is sent (allowed range is 0-365)')
    await page.goto(`/suppliers/${SUP}/financials`);
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Select a currency').fill('USD');
    await page.getByRole('option', { name: /USD/ }).first().click();
    await d.getByPlaceholder('Number of days').fill('366');
    const w = nextWrite(page, /currencies/);
    await d.getByRole('button', { name: 'Save' }).click();
    expect(await w, 'a currency with 366 payment days was sent').toBeNull();
  });

  test('TC-R2-04: An invalid IBAN ("123") is not accepted', async ({ page }) => {
    // BUG-59 fixed on the stage build of 21 Nov 2026 (was: 'BUG: an IBAN of "123" is sent - IBAN is not validated')
    await page.goto(`/suppliers/${SUP}/financials`);
    await page.getByRole('button', { name: 'Add bank account' }).first().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Name on the account').fill('QA Auto Holder');
    await d.getByPlaceholder('Bank name').fill('QA Auto Bank');
    await d.getByPlaceholder('IBAN, or IFSC for an Indian bank').fill('123');
    await d.getByPlaceholder('8 or 11 characters').fill('ABCDAEAD');
    const w = nextWrite(page, /bank/i);
    await d.getByRole('button', { name: 'Save' }).click();
    expect(await w, 'a bank account with IBAN "123" was sent').toBeNull();
  });

  test('TC-R2-05: A contact without an email is not accepted (email is mandatory)', async ({ page }) => {
    test.fail(true, 'BUG: a contact without email is sent - email must be mandatory');
    await page.goto(`/suppliers/${SUP}/contacts`);
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Full name').fill(`QA Auto Contact ${STAMP} no email`);
    await d.getByPlaceholder('Reservations, Sales, Accounts…').click();
    if (!(await page.getByRole('option').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) test.skip(true, 'DATA: no active Contact Type (role) in Core - reactivate one (question pending with the product owner)');
    await page.getByRole('option').first().click();
    const w = nextWrite(page, /contacts/);
    await d.getByRole('button', { name: 'Save' }).click();
    expect(await w, 'a contact without email was sent').toBeNull();
  });

  test('TC-R2-06: The supplier list can be searched by city', async ({ page }) => {
    // BUG-61 fixed on the stage build of 21 Nov 2026 (was: 'ENHANCEMENT: the supplier list has no City column / city search (product owner asked for it)')
    await page.goto('/suppliers');
    await expect(page.getByRole('columnheader', { name: /^City/ })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-R2-07: The default currency cannot be removed', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/financials`);
    await expect(page.getByRole('button', { name: 'Remove AED' })).toBeDisabled({ timeout: 60_000 });
  });
});

// =====================================================================================================================
test.describe('Part A - contract screens (nothing is saved)', () => {
  let blocked: string[];
  let c: ContractPage;
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill(`QA Auto Contract ${STAMP} check`);
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
  });

  test('TC-R2-10: "Sell to" after "Valid to" is not accepted', async ({ page }) => {
    // BUG-62 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a contract whose Sell to is after Valid to is sent')
    const end = (await c.dateValues())[1];
    const after = new Date(end); after.setDate(after.getDate() + 20);
    await c.setDate(3, after.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace('Sept', 'Sep'));
    const w = nextWrite(page, /\/contracts/);
    await c.saveButton.click();
    expect(await w, 'a contract selling after its validity ends was sent').toBeNull();
  });

  test('TC-R2-11: No "add an allotment first / on request" warning on a new contract (contract comes first)', async ({ page }) => {
    // BUG-63 fixed on the stage build of 21 Nov 2026 (was: 'BUG (product owner): the contract shows "No allotment holds <room> ... bookings go on request" - the contract is always created before the allotment')
    await c.addSeason('QA Season');
    await c.setPrice('Club Single', 'QA Season', '300');
    await page.waitForTimeout(1500);
    await expect(page.getByText(/No allotment holds/)).toHaveCount(0);
  });

  test('TC-R2-12: Season minimum stay of 0 or below is not accepted', async ({ page }) => {
    await c.button('Add season').click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Enter a season name').fill('QA Season');
    await d.getByPlaceholder('Any length').fill('-1');
    await d.getByRole('button', { name: 'Add season' }).click();
    const accepted = await d.isHidden().catch(() => true);
    const min = page.locator('main input[aria-label="Min nights"]:visible').first();
    expect(accepted && (await min.count()) > 0 && /^-|^0$/.test(await min.inputValue()), 'a season with minimum stay -1 was accepted').toBe(false);
  });

  test('TC-R2-13: Meal supplements cannot be for a board lower than the base plan (BB contract offers no "Room only")', async ({ page }) => {
    await c.button('Add meal supplement').click();
    await page.getByPlaceholder('Choose a plan').last().click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('option', { name: 'Room only', exact: true }), '"Room only" offered as a supplement on a Bed and breakfast contract').toHaveCount(0);
  });

  test('TC-R2-14: A cancellation charge above 100% is not accepted', async ({ page }) => {
    // BUG-64 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a cancellation charge of 150% is sent (max is 100%)')
    await c.button('Add cancellation policy').click();
    const value = page.locator('main input[type=number]:visible').last();
    await value.click(); await value.press('Control+A'); await value.pressSequentially('150'); await value.press('Tab');
    const w = nextWrite(page, /\/contracts/);
    await c.saveButton.click();
    const sent = await w;
    const pol = sent ? (JSON.parse(sent.postData() || '{}').cancellationPolicies ?? []) : [];
    console.log('cancellation sent: ' + JSON.stringify(pol));
    expect(sent === null || !JSON.stringify(pol).includes('150'), 'a 150% cancellation charge was sent').toBe(true);
  });
});

// =====================================================================================================================
test.describe('Part B - rules the server decides (REAL saves on QA data)', () => {
  test.describe.configure({ timeout: 300_000 });
  test.describe.configure({ mode: 'default' });
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
    test.setTimeout(400_000);
    try {
      for (const sub of ['Promotions', 'Allotment', 'Contract'] as const) {
        for (const product of ['Hotel', 'Excursion']) {
          await c.openProduct(SUP, product, sub).catch(() => {});
          for (let i = 0; i < 8; i++) {
            const on = c.rows.filter({ hasText: /^QA Auto (Contract|Allotment|Promotion)/ }).getByRole('switch', { checked: true });
            if (await on.count() === 0) break;
            await on.first().click();
            const d = page.getByRole('dialog').last();
            if (await d.isVisible({ timeout: 2500 }).catch(() => false)) await d.getByRole('button', { name: /Deactivate|Turn off|Yes|Confirm|Save/ }).last().click();
            await page.waitForTimeout(2500);
            await c.openProduct(SUP, product, sub);
          }
        }
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  /** fill a new contract; `prices` = how many of the 4 room prices to fill */
  const newContract = async (name: string, opts: { prices?: number; price?: string; seasons?: number } = {}) => {
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill(name);
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    const prio = String(100 + Math.floor(Math.random() * 800));
    await c.priority.click(); await c.priority.press('Control+A'); await c.priority.pressSequentially(prio); await c.priority.press('Tab');
    for (let s = 0; s < (opts.seasons ?? 1); s++) await c.addSeason(`QA Season ${s + 1}`);
    for (let s = 0; s < (opts.seasons ?? 1); s++)
      for (const r of ROOMS.slice(0, opts.prices ?? 4)) await c.setPrice(r, `QA Season ${s + 1}`, opts.price ?? '300');
  };
  /** click Save, return the server reply (null = nothing sent) */
  const save = async (): Promise<Response | null> => {
    const res = page.waitForResponse(r => ['POST', 'PUT'].includes(r.request().method()) && /\/contracts/.test(r.url()), { timeout: 20_000 }).catch(() => null);
    await c.saveButton.click();
    return res;
  };
  const refused = (r: Response | null) => r === null || !r.ok();

  test('TC-R2-20: A contract with a room price missing is NOT saved (every selected room needs a price)', async () => {
    await newContract(`QA Auto Contract ${STAMP} missing price`, { prices: 1 });
    expect(refused(await save()), 'contract with 3 missing prices was saved').toBe(true);
  });

  test('TC-R2-21: A price of 0 is NOT accepted', async () => {
    await newContract(`QA Auto Contract ${STAMP} zero price`, { price: '0' });
    expect(refused(await save()), 'contract with price 0 was saved').toBe(true);
  });

  test('TC-R2-22: Two seasons can never overlap (adding a season over the same dates splits them)', async () => {
    await newContract(`QA Auto Contract ${STAMP} overlap`, { seasons: 2 });     // both seasons are added with the full contract dates
    const rows = await page.getByPlaceholder('Enter a season name').evaluateAll(els => els.map(e => [...e.closest('tr')!.querySelectorAll('input')].slice(0, 2).map(i => (i as HTMLInputElement).value)));
    console.log('seasons after adding 2 over the same dates: ' + JSON.stringify(rows));
    const d = (s: string) => new Date(s).getTime();
    const sorted = rows.map(([a, b]) => [d(a), d(b)]).sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i][0], 'two seasons overlap').toBeGreaterThan(sorted[i - 1][1]);
  });

  test('TC-R2-23: A second contract with the SAME NAME is NOT accepted', async () => {
    test.fail(true, 'BUG: a second contract with the same name is saved');
    const name = `QA Auto Contract ${STAMP} same name`;
    await newContract(name);
    const first = await save();
    expect(first?.ok(), 'first contract failed').toBe(true);
    await newContract(name);
    expect(refused(await save()), 'a second contract with the same name was saved').toBe(true);
  });

  test('TC-R2-30: An allotment is NOT accepted for a product without a contract (Excursion has none)', async () => {
    await c.openProduct(SUP, 'Excursion', 'Allotment');
    // stage build of 21 Nov 2026 (BUG-66 fixed): no active contract -> Add allotment is disabled with an explanation
    if (await c.button('Add allotment').isDisabled()) {
      await expect(page.getByText(/no active contract yet. Add a contract first/)).toBeVisible();
      return;
    }
    await c.button('Add allotment').click();
    await page.getByPlaceholder('Enter an allotment name').fill(`QA Auto Allotment ${STAMP} no contract`);
    const unit = page.getByPlaceholder('Choose a unit');
    if (await unit.count()) await c.pick(unit, /./);
    if (await page.getByText(/No blocks queued/).count()) await c.button('Add block').click();
    const units = page.locator('main input[type=number]:visible').first();
    await units.click(); await units.press('Control+A'); await units.pressSequentially('3'); await units.press('Tab');
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /allotments/.test(r.url()), { timeout: 20_000 }).catch(() => null);
    await c.saveButton.click();
    expect(refused(await res), 'an allotment was saved for a product without any contract').toBe(true);
  });

  test('TC-R2-31: A promotion discount above 99% is NOT accepted', async () => {
    // BUG-67 (100% saved) - the 21 Nov build stops the save; the check below confirms it is the discount that is refused
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    await page.getByPlaceholder('Promotion name').fill(`QA Auto Promotion ${STAMP} 100pct`);
    await c.pick(page.getByPlaceholder('Choose a currency').first(), /AED/);
    const pct = page.locator('main input[type=number]:visible').nth(5);
    await pct.click(); await pct.press('Control+A'); await pct.pressSequentially('100'); await pct.press('Tab');
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /promotion/i.test(r.url()), { timeout: 20_000 }).catch(() => null);
    await c.saveButton.click();
    const r = await res;
    // 21 Nov build: the save is stopped by the form - make sure it is the DISCOUNT that is refused, not some other field
    let why = '';
    if (r === null && await c.problems.isVisible().catch(() => false)) {
      await c.problems.click().catch(() => {});
      await page.waitForTimeout(800);
      why = (await page.locator('.MuiPopover-paper:visible, .MuiTooltip-popper:visible').last().innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log('promotion problems: ' + why);
    }
    expect(refused(r), 'a 100% promotion was saved').toBe(true);
    if (why) expect(why, 'the problem named is the discount limit').toMatch(/discount|99|percent|%/i);
  });

  test('TC-R2-32: A promotion can only apply to approved, active contracts (no draft / inactive in the list)', async () => {
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await c.button('Add promotion').click();
    await page.getByPlaceholder('All active contracts').click();
    await page.waitForTimeout(2000);
    const offered = (await page.getByRole('option').allInnerTexts()).map(s => s.replace(/\s+/g, ' '));
    console.log('promotion can apply to: ' + offered.join(' | '));
    const shot = await page.screenshot();                        // evidence of the open list (kept only if it is wrong)
    await page.keyboard.press('Escape');
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const notApprovedOrInactive = await c.rows.filter({ hasNot: page.getByRole('switch', { checked: true }) }).or(c.rows.filter({ hasText: 'Draft' })).locator('td:first-child p').allInnerTexts();
    const wrong = offered.filter(o => notApprovedOrInactive.some(n => o.includes(n.trim())));
    if (wrong.length) {
      const fs = await import('fs');
      fs.mkdirSync('screenshots/bugs', { recursive: true });
      fs.writeFileSync('screenshots/bugs/BUG-133-1-promotion-offers-draft-contracts.png', shot);
      await page.screenshot({ path: 'screenshots/bugs/BUG-133-2-those-contracts-are-draft.png' });
      console.log('draft / inactive offered: ' + wrong.join(' | '));
    }
    expect(wrong, 'draft / inactive contracts offered for a promotion').toEqual([]);
  });
});
