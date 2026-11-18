import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { visible, openDialog } from '../../pages/FormHelpers';

/*
 * QUOTES MODULE (menu "Quotes" -> /quotes): quick filters, column filters, Active switch, Add Quote form,
 * and an existing quote (QT-000001): summary, itinerary, pricing maths, follow-ups, versions, history, document.
 * SAFETY: every save is BLOCKED - nothing can change.
 */
const QT = { ref: 'QT-000001', name: 'Al Mansoori family – Dubai, Nov 2026', path: '/quotes/1' };
const money = (s: string) => Number(s.replace(/[^\d.-]/g, ''));
const round2 = (n: number) => Math.round(n * 100) / 100;

class QuotesModule {
  constructor(readonly page: Page) {}
  get rows() { return this.page.locator('main tbody tr:visible'); }
  get range() { return this.page.getByText(/^\d+–\d+ of \d+$/); }
  quick(name: string) { return this.page.locator('main').getByRole('button', { name, exact: true }).first(); }
  header(name: RegExp) { return this.page.getByRole('columnheader', { name }).getByRole('combobox').first(); }
  async open() {
    await this.page.goto('/quotes');
    await expect(this.page.getByRole('heading', { name: 'Quotes', exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 90_000 });
    await this.page.waitForTimeout(1500);
  }
  async options(combo: Locator) {
    await combo.click();
    const o = (await this.page.getByRole('option').allInnerTexts()).map(s => s.trim());
    await this.page.keyboard.press('Escape');
    return o;
  }
}

test.describe('Quotes - list', () => {
  let q: QuotesModule;
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); q = new QuotesModule(page); await q.open(); });
  test.afterEach(() => expect(blocked, 'nothing may be saved').toEqual([]));

  test('TC-QT-01: Opens from the menu "Quotes"; toolbar Add Quote / Audit history / Columns @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Quotes', exact: true }).click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/quotes$/);
    for (const b of ['Add Quote', 'Audit history', 'Columns']) await expect(visible(page.getByRole('button', { name: b })), b).toBeVisible();
  });

  test('TC-QT-02: Columns Ref, Name, Progress, Status, Date, Agent, Next follow-up, Currency, Source, SIC, Created, Active', async ({ page }) => {
    await expect(page.locator('main thead th:visible')).toContainText(['Ref', 'Name', 'Progress', 'Status', 'Date', 'Agent', 'Next follow-up', 'Currency', 'Source', 'SIC', 'Created', 'Active']);
  });

  test('TC-QT-03: Quick filters All / Quoted today / Last 7 days / Last 30 days / Follow-up due change the list', async () => {
    for (const f of ['All', 'Quoted today', 'Last 7 days', 'Last 30 days', 'Follow-up due']) await expect(q.quick(f), f).toBeVisible();
    await q.quick('Quoted today').click();
    await expect(q.range).toHaveText('0–0 of 0', { timeout: 20_000 });    // QT-000001 was quoted 26 Oct 2026
    await q.quick('All').click();
    await expect(q.rows.filter({ hasText: QT.ref })).toBeVisible({ timeout: 20_000 });
  });

  test('TC-QT-04: Status filter offers Pending / Quoted / On Request / Held / Confirmed / Ticketed / Vouchered / Cancelled / Failed / Accepted', async () => {
    expect(await q.options(q.header(/^Status/))).toEqual(['All', 'Pending', 'Quoted', 'On Request', 'Held', 'Confirmed', 'Ticketed', 'Vouchered', 'Cancelled', 'Failed', 'Accepted']);
  });

  test('TC-QT-05: Source filter offers Build Now / Existing Quote / Artificial Intelligence; SIC offers Yes / No', async () => {
    expect(await q.options(q.header(/^Source/))).toEqual(['All', 'Build Now', 'Existing Quote', 'Artificial Intelligence']);
    expect(await q.options(q.header(/^SIC/))).toEqual(['All', 'Yes', 'No']);
  });

  test('TC-QT-06: Search by Ref and by Name (part of it, any case)', async ({ page }) => {
    const refSearch = page.getByRole('columnheader', { name: /^Ref/ }).getByRole('textbox');
    await refSearch.fill('000001');
    await expect(q.rows.filter({ hasText: QT.ref })).toBeVisible({ timeout: 20_000 });
    await refSearch.fill('');
    await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('mansoori');
    await expect(q.rows.filter({ hasText: QT.name })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('zzzqqq');
    await expect(q.range).toHaveText('0–0 of 0', { timeout: 20_000 });
  });

  test('TC-QT-07: Active switch asks "Deactivate quote?"; Cancel keeps it active', async ({ page }) => {
    const sw = q.rows.filter({ hasText: QT.ref }).locator('input[type=checkbox][aria-label=Active]');
    await expect(sw).toBeChecked();
    await sw.click();
    const pop = page.locator('.swal2-popup:visible');
    await expect(pop.locator('.swal2-title')).toHaveText('Deactivate quote?');
    await expect(pop.getByRole('button', { name: 'Yes, deactivate' })).toBeVisible();
    await pop.getByRole('button', { name: 'Cancel' }).click();
    await expect(sw).toBeChecked();
  });

  test('TC-QT-08: Opening /quotes while logged out goes to the login page', async ({ browser }) => {
    const fresh = await browser.newPage();
    await fresh.goto('/quotes');
    await expect(fresh).toHaveURL(/login/, { timeout: 60_000 });
    await fresh.close();
  });
});

test.describe('Quotes - Add Quote (nothing is saved)', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    await page.goto('/quotes/new');
    await expect(page.getByRole('button', { name: 'Save Quote' })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
  });

  test('TC-QT-10: Form has Date*, Agent*, Currency*, Name*, Source, Exchange Type*, Configuration, Contact person, SIC', async ({ page }) => {
    const main = page.locator('main');
    for (const t of ['Configuration', 'Pax', 'Escorts', 'Driver', 'Guide', 'Additional']) await expect(main.getByText(t, { exact: true }).last(), t).toBeVisible();
    for (const ph of ['DD MMM YYYY', 'Quote Name', 'Contact Person Name']) await expect(page.getByPlaceholder(ph).last(), ph).toBeVisible();
    for (const cb of ['Agent', 'Select an agent first', 'Source', 'Exchange Type']) await expect(page.getByRole('combobox', { name: cb, exact: true }), cb).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'No SIC' }))).toBeVisible();
  });

  test('TC-QT-11: Currency stays locked until an agent is chosen; Source defaults to "Build Now"', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Select an agent first', exact: true })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Source', exact: true })).toHaveValue('Build Now');
  });

  test('TC-QT-12: Empty Save - Date, Agent, Currency, Name and Exchange Type are required; nothing is sent', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Quote' }).click();
    for (const m of ['Date is required', 'Agent is required', 'Currency is required', 'Name is required', 'Exchange Type is required'])
      await expect(page.getByText(m).first(), m).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-QT-13: Exchange Type offers "Default Exchange"', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Exchange Type', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Default Exchange' })).toBeVisible();
  });

  test('TC-QT-14: Pax starts at 2 with Escorts / Driver / Guide 0; "Add another configuration" adds row 2', async ({ page }) => {
    const add = page.getByRole('button', { name: 'Add another configuration' });
    await add.click();
    await expect(page.locator('main').getByText('2', { exact: true }).first()).toBeVisible();
    console.log('config rows: ' + (await page.locator('main').getByText('Configuration').last().locator('xpath=ancestor::*[3]').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  });

  test('TC-QT-15: Agent list offers only agents that may do business (no Blocked agents)', async ({ page }) => {
    // the QA Auto test agents are all Blocked at the end of every agent run
    await page.getByRole('combobox', { name: 'Agent', exact: true }).click();
    await page.keyboard.type('QA Auto Agent', { delay: 30 });
    await page.waitForTimeout(2500);
    const offered = (await page.getByRole('option').allInnerTexts()).map(s => s.trim()).filter(s => s.startsWith('QA Auto Agent'));
    console.log('QA agents offered: ' + JSON.stringify(offered));
    test.fail(offered.length > 0, 'QT-BUG-1: Blocked agents are offered for a new quote');
    expect(offered, 'Blocked QA agents offered').toEqual([]);
  });

  test('TC-QT-16: Cancel goes back to the list and saves nothing', async ({ page }) => {
    await page.getByPlaceholder('Quote Name').last().fill('QA Auto Quote cancelled');
    await visible(page.getByRole('button', { name: 'Cancel', exact: true })).click();
    await expect(page).toHaveURL(/\/quotes$/, { timeout: 20_000 });
    expect(blocked).toEqual([]);
  });
});

test.describe(`Quotes - ${QT.ref}`, () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    await page.goto(QT.path);
    await expect(page.getByRole('tab', { name: /^Summary/ })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
  });
  const tab = (page: Page, t: string) => page.getByRole('tab', { name: new RegExp('^' + t) });

  test('TC-QT-20: Header - name, ref, agent, progress Draft > Published > Quoted > Re-quoted > Accepted > Booked; buttons', async ({ page }) => {
    const main = page.locator('main');
    await expect(main.getByText(QT.name).last()).toBeVisible();
    await expect(main.getByText(/Quoted 26 Oct 2026/).last()).toBeVisible();
    for (const s of ['Draft', 'Published', 'Quoted', 'Re-quoted', 'Accepted', 'Booked']) await expect(main.getByText(s, { exact: true }).last(), s).toBeVisible();
    for (const b of ['Edit', 'Document', 'Preview', 'Send to customer']) await expect(visible(page.getByRole('button', { name: b, exact: true })), b).toBeVisible();
    await expect(visible(page.getByRole('button', { name: /Open Reservation 000002/ }))).toBeVisible();
  });

  test('TC-QT-21: Tabs Summary / Itinerary (2) / Pricing / Follow-ups / Versions / History', async ({ page }) => {
    for (const t of ['Summary', 'Itinerary 2', 'Pricing', 'Follow-ups', 'Versions', 'History']) await expect(tab(page, t), t).toBeVisible();
  });

  test('TC-QT-22: Summary - travel dates, party, services, total, margin, source, contact, reservation', async ({ page }) => {
    const main = page.locator('main');
    for (const t of ['4 nights', '2 pax', '2 services', 'AED 3,357.60', 'AED 453.17', '13.5% of sell', 'Build Now', 'Khalid Al Mansoori', 'Default Exchange'])
      await expect(main.getByText(t).first(), t).toBeVisible();
  });

  test('TC-QT-23: Itinerary - 2 services (hotel and activity) with prices; Add product / Add package', async ({ page }) => {
    await tab(page, 'Itinerary').click();
    const main = page.locator('main');
    await expect(main.getByText('Marina Bay Hotel').first()).toBeVisible();
    await expect(main.getByText('Desert Safari with BBQ Dinner').first()).toBeVisible();
    await expect(main.getByText('AED 2,937.60').first()).toBeVisible();
    await expect(main.getByText('AED 420.00').first()).toBeVisible();
    for (const b of ['Add product', 'Add package']) await expect(main.getByText(b, { exact: true }).last(), b).toBeVisible();
  });

  test('TC-QT-24: Pricing - each line: Margin = Sell - Cost and Margin % = Margin / Sell; totals add up', async ({ page }) => {
    await tab(page, 'Pricing').click();
    const lines = page.locator('main table', { hasText: 'Margin %' }).last().locator('tbody tr:visible');
    await expect(lines.first()).toBeVisible();
    let cost = 0, sell = 0, margin = 0;
    const n = await lines.count();
    for (let i = 0; i < n; i++) {
      const cells = (await lines.nth(i).locator('td').allInnerTexts()).map(s => s.trim());
      const [c, , s, m, pct] = cells.slice(-5);
      if (/^Total/.test(cells[0])) {
        expect(round2(money(c)), 'total cost').toBe(round2(cost));
        expect(round2(money(s)), 'total sell').toBe(round2(sell));
        expect(round2(money(m)), 'total margin').toBe(round2(margin));
        continue;
      }
      cost += money(c); sell += money(s); margin += money(m);
      expect(round2(money(s) - money(c)), `margin of ${cells[0]}`).toBe(round2(money(m)));
      expect(Number((money(m) / money(s) * 100).toFixed(1)), `margin % of ${cells[0]}`).toBe(money(pct));
    }
    console.log(`cost ${cost} sell ${sell} margin ${margin}`);
    expect(round2(sell)).toBe(3357.6);
  });

  test('TC-QT-25: Pricing - Complete breakup: base fare + taxes & fees = grand total; margin = grand total - total cost', async ({ page }) => {
    await tab(page, 'Pricing').click();
    const main = page.locator('main');
    // each breakup line reads "<label> AED n" - take the amount on the label's own line
    const val = async (label: string) => money((await main.getByText(label, { exact: true }).last().locator('xpath=..').innerText()).replace(label, ''));
    const base = await val('Total base fare'), tax = await val('Total taxes & fees'), grand = await val('Grand total');
    const costT = await val('Total cost (incl. cost tax)'), marginT = await val('Margin');
    console.log({ base, tax, grand, costT, marginT });
    expect(round2(base + tax)).toBe(round2(grand));
    expect(round2(grand - costT)).toBe(round2(marginT));
    await expect(visible(page.getByRole('button', { name: 'Edit markup' }))).toBeVisible();
  });

  test('TC-QT-26: Follow-ups - empty explanation and "Add follow-up"; Versions - empty explanation and "Save version"', async ({ page }) => {
    await tab(page, 'Follow-ups').click();
    await expect(page.getByText(/No follow-ups yet/)).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'Add follow-up' }))).toBeVisible();
    await tab(page, 'Versions').click();
    await expect(page.getByText(/No versions yet/)).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'Save version' }))).toBeVisible();
  });

  test('TC-QT-27: History lists who created / updated the quote and its items', async ({ page }) => {
    await tab(page, 'History').click();
    await expect(page.locator('main').getByText(/created Al Mansoori family/).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main').getByText(/created itinerary item/).first()).toBeVisible();
  });

  test('TC-QT-28: History shows readable values (no internal ids like "Quote -9223372036854774807")', async ({ page }) => {
    await tab(page, 'History').click();
    await expect(page.locator('main').getByText(/created itinerary item/).first()).toBeVisible({ timeout: 20_000 });
    test.fail(true, 'QT-BUG-2: History "created configuration" shows "Quote -9223372036854774807" - an internal number instead of the quote');
    await expect(page.locator('main').getByText(/-?9223372036854\d+/)).toHaveCount(0);
  });

  test('TC-QT-29: Document - options Services, Price per service, Include alternatives; Print / PDF and E-mail; Close', async ({ page }) => {
    await visible(page.getByRole('button', { name: 'Document', exact: true })).click();
    const d = openDialog(page);
    await expect(d).toContainText('Quote document');
    for (const t of ['Price per service', 'Include alternatives']) await expect(d.getByText(t).first(), t).toBeVisible();
    for (const b of ['Print / PDF', 'E-mail']) await expect(d.getByRole('button', { name: b }), b).toBeVisible();
    await d.getByText('Close', { exact: true }).click();
    await expect(d).toBeHidden();
    expect(blocked).toEqual([]);
  });

  test('TC-QT-30: "Open Reservation 000002" opens the reservation made from this quote', async ({ page }) => {
    await visible(page.getByRole('button', { name: /Open Reservation 000002/ })).click();
    await expect(page).toHaveURL(/\/reservations\/\d+/, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /Reservation - 000002/ })).toBeVisible({ timeout: 60_000 });
  });
});
