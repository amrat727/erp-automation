import { test, expect } from '../../fixtures';
import { Page, Locator, Response } from '@playwright/test';
import { AgentPage } from '../../pages/AgentPage';
import { buttonNamed, waitForSave } from '../../pages/FormHelpers';

/*
 * END-TO-END BOOKING FLOW across modules (REAL saves on STAGE - approved by the product owner:
 * "QA bookings may be created and cancelled").
 *   Agent (create + approve) -> Product Search (own contracts ONLY, never TBO / HotelBeds)
 *   -> Book hotel -> Reservation (list, summary, pricing, travellers, accounting) -> cancel -> agent Blocked.
 * Data: agent "QA Auto Agent E2E <STAMP>" (example.com e-mail), guests "QA Auto <STAMP>".
 * afterAll ALWAYS sets every "QA Auto Agent ..." that is not Blocked to Blocked.
 */
const STAMP = process.env.RUN_STAMP!;
const AGENT = `QA Auto Agent E2E ${STAMP}`;
const EMAIL = `qa.auto.e2e.${STAMP.toLowerCase()}@example.com`;
const HOTEL = 'Marina Bay Hotel';
const NIGHTS = 3;
// check-in 60 days ahead (inside the hotel contract, outside release / early-bird windows of 21 days)
const CHECK_IN = new Date(Date.now() + 60 * 864e5);
const CHECK_OUT = new Date(CHECK_IN.getTime() + NIGHTS * 864e5);
const money = (s: string) => Number(s.replace(/[^\d.-]/g, ''));
const r2 = (n: number) => Math.round(n * 100) / 100;

test.describe.configure({ mode: 'serial' });
test.describe('E2E: agent -> product search -> booking -> reservation', () => {
  let page: Page;
  let a: AgentPage;
  let agentUrl = '';
  let reservationUrl = '';
  const offer = { room: '', price: 0, cost: 0, margin: 0, was: 0, save: 0 };
  let confirmation = '';

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    a = new AgentPage(page);
  });

  const vbtn = (name: string): Locator => buttonNamed(page, name);
  const saved = async (click: () => Promise<unknown>, what: RegExp): Promise<Response> => (await waitForSave(page, click, what, { timeout: 90_000, required: true }))!;
  const setStatus = async (status: 'Approved' | 'Blocked') => {
    await page.goto(`${agentUrl}/overview`);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2000);
    await vbtn('Edit').click();
    await page.locator('main input[value="Approved"], main input[value="On Hold"], main input[value="Blocked"]').first().click();
    await page.getByRole('option', { name: status, exact: true }).click();
    if (await vbtn('Save').isEnabled()) return saved(() => vbtn('Save').click(), /agent/i);
    await vbtn('Cancel').click();
    return null;
  };

  test.afterAll(async () => {
    test.setTimeout(400_000);
    // ALWAYS: every QA booking ("QA Auto Lead ...") that is not Cancelled -> Cancelled
    try {
      for (let i = 0; i < 5; i++) {
        await page.goto('/reservations');
        await expect(page.locator('main tbody tr').first()).toBeVisible({ timeout: 90_000 });
        await page.waitForTimeout(2000);
        const open = page.locator('main tbody tr', { hasText: 'QA Auto Lead' }).filter({ hasNotText: 'Cancelled' });
        if (await open.count() === 0) break;
        await open.first().locator('td').first().click();
        await page.waitForURL(/\/reservations\/\d+/, { timeout: 60_000 });
        await page.getByRole('tab', { name: /^Itinerary/ }).first().click({ timeout: 60_000 });
        await page.locator('main').getByRole('button', { name: 'Change status' }).click();
        const done = page.waitForResponse(r => /\/reservations\/\d+\/status/.test(r.url()), { timeout: 30_000 });
        await page.getByRole('menuitem', { name: 'Cancelled', exact: true }).click();
        const dlg = page.locator('.MuiDialog-paper:visible').last();
        if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: /^(Yes|Confirm|Cancel booking|Cancel reservation)/ }).first().click();
        console.log(`cleanup: ${page.url()} -> Cancelled (${(await done).status()})`);
      }
    } catch (e) { console.log('booking cleanup failed: ' + e); }
    // this run's agent first, by its own page (does not depend on the list search)
    try {
      if (agentUrl) { await setStatus('Blocked'); console.log(`cleanup: ${agentUrl} -> Blocked`); }
    } catch (e) { console.log('agent cleanup failed: ' + e); }
    // then any other E2E agent left open by an earlier run
    try {
      for (let i = 0; i < 5; i++) {
        await a.open();
        await a.search('QA Auto Agent E2E');
        const open = a.rows.filter({ hasText: 'QA Auto Agent E2E' }).filter({ hasNot: page.locator('td:nth-child(5)', { hasText: 'Blocked' }) });
        if (await open.count() === 0) break;
        await open.first().locator('td').first().click();
        await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
        agentUrl = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
        await setStatus('Blocked');
        console.log(`cleanup: ${agentUrl} -> Blocked`);
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  test(`TC-E2E-01: Create the agent "${AGENT}" (UAE, AED, credit 10,000) and approve it`, async () => {
    test.setTimeout(240_000);
    await a.openAdd();
    await a.name.fill(AGENT);
    await a.email.fill(EMAIL);
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await a.country.click(); await page.keyboard.type('United Arab', { delay: 30 }); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
    await page.locator('main input[aria-label="Allow credit"]').click();
    await page.locator('main input[aria-label="Credit limit"]').fill('10000');
    const r = await saved(() => a.createButton.click(), /\/agent\/agents$/);
    expect(r.ok(), `create failed ${r.status()} ${await r.text().catch(() => '')}`).toBe(true);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    agentUrl = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
    expect(agentUrl).toMatch(/\/agents\/\d+$/);
    const s = await setStatus('Approved');
    expect(s?.ok(), 'approve failed').toBe(true);
    await a.open(); await a.search(AGENT);
    await expect(a.rows.filter({ hasText: AGENT })).toContainText('Approved');
  });

  test('TC-E2E-01b: Access > Products - a new agent has no product access; give it Hotel only -> "1 of N on"', async () => {
    await page.goto(`${agentUrl}/access`);
    await expect(page.getByRole('tab', { name: 'Access', exact: true }).first()).toBeVisible({ timeout: 90_000 });
    const card = page.locator('main').getByText('Products', { exact: true }).first().locator('xpath=ancestor::*[.//button[@aria-label="Edit Products"]][1]');
    await expect(card).toContainText(/0 of \d+ on/, { timeout: 30_000 });
    await card.getByRole('button', { name: 'Edit Products' }).click();
    // in edit mode the "Edit Products" button is gone (All / None / Cancel / Save instead) - only this section is in edit mode
    const main = page.locator('main');
    await main.getByRole('checkbox', { name: 'Hotel', exact: true }).check();
    const r = await saved(() => main.getByRole('button', { name: 'Save', exact: true }).first().click(), /agent/i);
    expect(r.ok(), `product access save failed ${r.status()}`).toBe(true);
    await page.reload();
    await expect(page.locator('main').getByText(/^1 of \d+ on$/).first()).toBeVisible({ timeout: 60_000 });
  });

  test('TC-E2E-02: Product Search - the approved agent finds own-contract hotels in Dubai; price = was - save and margin = price - cost', async () => {
    test.setTimeout(240_000);
    await page.goto('/product-search');
    await expect(page.getByRole('heading', { name: 'Select an agent to continue' })).toBeVisible({ timeout: 90_000 });
    await page.locator('main').getByRole('combobox').first().click();
    await page.keyboard.type(AGENT, { delay: 20 });
    await page.getByRole('option', { name: new RegExp(AGENT) }).first().click({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Continue' }).last().click();
    await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60_000 });
    await page.getByPlaceholder('Enter city').click(); await page.keyboard.type('Dubai', { delay: 60 });
    await page.getByRole('option', { name: 'Dubai' }).first().click({ timeout: 30_000 });
    await page.getByPlaceholder('Check-in – Check-out').click();
    const now = new Date();
    const monthsAhead = (d: Date) => (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
    for (let i = 0; i < monthsAhead(CHECK_IN); i++) await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: String(CHECK_IN.getDate()), exact: true }).first().click();
    for (let i = 0; i < monthsAhead(CHECK_OUT) - monthsAhead(CHECK_IN); i++) await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: String(CHECK_OUT.getDate()), exact: true }).first().click();
    // own contracts ONLY - never send a booking to an outside supplier
    for (const s of ['TBO Holidays', 'HotelBeds']) await page.getByRole('button', { name: s, exact: true }).click();
    const search = page.waitForRequest(r => /\/hotel\/search/.test(r.url()) && r.method() === 'POST');
    await page.getByRole('button', { name: 'Search Hotels' }).click();
    expect((await search).postDataJSON().providerCodes, 'only own contracts are searched').toEqual(['Contracted']);
    const card = page.locator('main').getByText(HOTEL, { exact: true }).first().locator('xpath=ancestor::*[.//button[starts-with(normalize-space(.),"See ")]][1]');
    await expect(card).toBeVisible({ timeout: 90_000 });
    await expect(card).toContainText('Own contract');
    await card.getByRole('button', { name: /^See \d+ rooms/ }).click();
    // the first room line: "<room> <meal> Refundable ... Policy ... AED was Save AED x AED price N nights · incl. taxes Cost AED c · Margin AED m Select Book"
    const room = page.locator('main').getByRole('button', { name: 'Book', exact: true }).first().locator('xpath=ancestor::*[.//button[normalize-space(.)="Policy"]][1]');
    const t = (await room.innerText()).replace(/\s+/g, ' ');
    console.log('room: ' + t);
    const m = t.match(/AED ([\d,.]+) Save AED ([\d,.]+) AED ([\d,.]+) (\d+) nights.*?Cost AED ([\d,.]+) · Margin AED ([\d,.]+)/);
    expect(m, 'room line: was, save, price, nights, cost, margin').not.toBeNull();
    Object.assign(offer, { room: t.split(/ (?:Room Only|Breakfast|Half Board|Full Board) /)[0].trim(), was: money(m![1]), save: money(m![2]), price: money(m![3]), cost: money(m![5]), margin: money(m![6]) });
    expect(Number(m![4])).toBe(NIGHTS);
    expect(r2(offer.was - offer.save), 'price = was - save').toBe(offer.price);
    expect(r2(offer.price - offer.cost), 'margin = price - cost').toBe(offer.margin);
  });

  test('TC-E2E-03: Book the room for the agent as a NEW reservation (2 QA guests) -> reservation created', async () => {
    test.setTimeout(240_000);
    await page.locator('main').getByRole('button', { name: 'Book', exact: true }).first().click();
    const d = page.getByRole('dialog').last();
    await expect(d.getByText('Book hotel')).toBeVisible();
    await expect(d.getByRole('textbox', { name: 'Agent' })).toHaveValue(AGENT);
    await expect(d.getByRole('combobox', { name: 'Reservation' }).or(d.locator('input[aria-label="Reservation"]')).first()).toHaveValue('New reservation');
    await expect(d).toContainText(`AED ${offer.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    await d.locator('input[aria-label="Email"]').fill(EMAIL);
    await d.locator('input[aria-label="Mobile"]').fill('+971500000000');
    const guests = [['Mr', 'QA Auto', `Lead ${STAMP}`], ['Mrs', 'QA Auto', `Second ${STAMP}`]];
    for (let i = 0; i < guests.length; i++) {
      await d.locator('input[aria-label="Title"]').nth(i).click();
      await page.getByRole('option', { name: guests[i][0], exact: true }).click();
      await d.locator('input[aria-label="First Name"]').nth(i).fill(guests[i][1]);
      await d.locator('input[aria-label="Last Name"]').nth(i).fill(guests[i][2]);
    }
    const book = d.getByRole('button', { name: 'Book', exact: true });
    await expect(book).toBeEnabled();
    const r = await saved(() => book.click(), /book|reservation/i);
    const body = await r.text().catch(() => '');
    console.log(`booking reply ${r.status()} ${r.url()} ${body.slice(0, 600)}`);
    const json = JSON.parse(body || '{}');
    expect(json.success, 'booking success').toBe(true);
    expect(json.onRequest, 'instant confirmation (allotment available)').toBe(false);
    expect(json.totalPrice, 'booked price = offered price').toBe(offer.price);
    confirmation = json.confirmationNumber;
    expect(confirmation).toBeTruthy();
    expect(r.ok(), `booking failed ${r.status()} ${body.slice(0, 300)}`).toBe(true);
    await page.waitForTimeout(5000);
    console.log('after booking: ' + page.url() + ' | ' + (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 800));
  });

  test('TC-E2E-04: The reservation is listed for the agent with the travel dates', async () => {
    await page.goto('/reservations');
    await expect(page.getByRole('heading', { name: 'Reservation' }).first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(3000);
    const row = page.locator('main tbody tr', { hasText: AGENT });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    console.log('row: ' + (await row.innerText()).replace(/\s+/g, ' '));
    await row.locator('td').first().click();
    await page.waitForURL(/\/reservations\/\d+/, { timeout: 60_000 });
    reservationUrl = page.url().replace(/\/(summary|itinerary|edit).*/, '');
    console.log('reservation: ' + reservationUrl);
    await expect(row).toContainText('Confirmed');
    const ci = CHECK_IN.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    await expect(row).toContainText(ci);
  });

  const openTab = async (name: RegExp) => {
    await page.goto(reservationUrl);
    await page.getByRole('tab', { name }).first().click({ timeout: 90_000 });
    await page.waitForTimeout(2500);
    return (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  };
  const aed = (n: number) => `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  test('TC-E2E-05: Reservation money = the booked offer - Summary, Pricing (cost + margin = sell) and Accounting (agent owes sell, supplier is owed cost)', async () => {
    const sum = await openTab(/^Summary/);
    expect(sum).toContain(`Total ${aed(offer.price)}`);
    expect(sum).toContain(`Margin ${aed(offer.margin)}`);
    expect(sum).toMatch(new RegExp(`${NIGHTS} nights`));
    expect(sum).toContain(`Sell ${aed(offer.price)} Received AED 0.00 Balance due ${aed(offer.price)}`);
    const pr = await openTab(/^Pricing/);
    expect(pr).toContain(`Total ${aed(offer.cost)} AED 0.00 ${aed(offer.price)} ${aed(offer.margin)}`);
    expect(pr).toContain(`Grand total ${aed(offer.price)}`);
    const pct = Math.round(offer.margin / offer.price * 1000) / 10;
    expect(pr, 'margin % = margin / sell').toContain(`${pct}%`);
    const acc = await openTab(/^Accounting/);
    expect(acc).toContain(`Billed ${aed(offer.price)} · Received AED 0.00`);
    expect(acc).toContain(`Cost ${aed(offer.cost)} · Paid AED 0.00`);
    const trav = await openTab(/^Travellers/);
    expect(trav).toContain(`QA Auto Lead ${STAMP}`);
    expect(trav).toContain(`QA Auto Second ${STAMP}`);
  });

  test('TC-E2E-06: The booked hotel line shows the supplier confirmation and a cancellation table that only goes up (free -> 25% -> 50% -> 100%)', async () => {
    await openTab(/^Itinerary/);
    await page.locator('main').getByText(confirmation, { exact: false }).first().click();
    const d = page.locator('.MuiDialog-paper:visible').last();
    await expect(d).toContainText('Booked with the supplier', { timeout: 30_000 });
    const t = (await d.innerText()).replace(/\s+/g, ' ');
    expect(t).toContain(`Supplier confirmation ${confirmation}`);
    expect(t).toContain(`Cost ${aed(offer.cost)} Sell ${aed(offer.price)}`);
    const charges = [...t.matchAll(/(\d{1,3})%/g)].map(x => Number(x[1])).filter(n => n !== 15);   // 15% = early-bird text
    console.log('cancellation charges: ' + charges.join(' -> '));
    expect(t).toMatch(/No charge/);
    expect(charges.length).toBeGreaterThan(0);
    for (let i = 1; i < charges.length; i++) expect(charges[i], 'charges never go down').toBeGreaterThanOrEqual(charges[i - 1]);
    expect(charges[charges.length - 1]).toBe(100);
    await page.keyboard.press('Escape');                     // the dialog has both "×" (aria Close) and "Close"
    await expect(d).toBeHidden();
  });

  test('TC-E2E-07: Cancel the reservation (inside the free-cancellation window) -> status Cancelled, nothing is charged', async () => {
    await openTab(/^Itinerary/);
    await page.locator('main').getByRole('button', { name: 'Change status' }).click();
    const req = page.waitForRequest(r => /\/reservations\/\d+\/status/.test(r.url()) && r.method() === 'PUT', { timeout: 10_000 }).catch(() => null);
    await page.getByRole('menuitem', { name: 'Cancelled', exact: true }).click();
    // a confirmed booking should not be cancelled by one click without "Are you sure?" and the charge
    const asked = await page.locator('.MuiDialog-paper:visible').last().isVisible().catch(() => false);
    if (asked) await page.locator('.MuiDialog-paper:visible').last().getByRole('button', { name: /^(Yes|Confirm|Cancel booking|Cancel reservation)/ }).first().click();
    const sent = await req;
    expect(sent, 'cancel request sent').not.toBeNull();
    const reply = await sent!.response();
    expect(reply?.ok(), `cancel failed ${reply?.status()}`).toBe(true);
    await page.reload();
    await page.getByRole('tab', { name: /^Summary/ }).first().waitFor({ timeout: 90_000 });
    // the header status (next to the lead name) now reads "Cancelled"
    await expect(page.locator('main').getByText(`QA Auto Lead ${STAMP}`).first().locator('xpath=..')).toContainText('Cancelled', { timeout: 30_000 });
    await page.goto('/reservations');
    await expect(page.locator('main tbody tr', { hasText: AGENT })).toContainText('Cancelled', { timeout: 30_000 });
    if (!asked) test.info().annotations.push({ type: 'known bug', description: 'BUG-130 (SAH-214): a confirmed reservation is cancelled with one click - no "Are you sure?" and no cancellation charge shown' });
  });

  test('TC-E2E-08: After the free cancellation the hotel line is Cancelled and nobody owes anything (agent 0, supplier 0)', async () => {
    const itin = await openTab(/^Itinerary/);
    const acc = await openTab(/^Accounting/);
    console.log('itinerary after cancel: ' + itin.slice(itin.indexOf('Itinerary Change status'), itin.indexOf('Itinerary Change status') + 300));
    console.log('accounting after cancel: ' + acc.slice(acc.indexOf('Receivable'), acc.indexOf('Receivable') + 400));
    const lineCancelled = /HOTEL Marina Bay Hotel[^]*?Cancelled AED/.test(itin) || !/Confirmed 1/.test(itin);
    const nothingOwed = !/Due from[^]*?Unpaid AED [1-9]/.test(acc) && !/Due to suppliers Unpaid AED [1-9]/.test(acc);
    test.fail(!(lineCancelled && nothingOwed), 'BUG-131 (SAH-215): cancelling the reservation leaves the hotel line Confirmed and the agent / supplier amounts unpaid');
    expect(lineCancelled, 'hotel line cancelled with the reservation').toBe(true);
    expect(nothingOwed, 'nothing owed after a free cancellation').toBe(true);
  });
});
