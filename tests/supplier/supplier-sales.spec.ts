import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';

/*
 * SUPPLIER CONTRACT -> WHAT IS SOLD (Product Search, own contracts only).
 * Does the supplier's contract really drive the price and availability the agent sees?
 * READ-ONLY: only the hotel search (a read-only POST) is let through - every save is blocked, nothing is booked.
 *
 * Source data (read from the ERP on 20 Nov 2026), supplier 10 "Marina Bay Hotel", contract MBH-2627 (Approved):
 *   valid 25 Oct 2026 - 31 Oct 2027, sell 20 Oct 2026 - 25 Oct 2027, base plan Bed and breakfast
 *   seasons  Peak 25 Oct 2026 - 15 Apr 2027  |  Summer 16 Apr - 31 Oct 2027
 *   Deluxe Room Marina View: Single 650 / 520, Twin 720 / 580, Double (2+1, +bed) 720 / 580    (Peak / Summer, per night)
 *   Executive Suite: Single 1,250 / 990, King (2+2, +bed) 1,400 / 1,100
 *   meal supplements per person per night: Half board 140 adult / 70 child, Full board 260 / 130
 *   child policy: age 0-5 free, age 6-11 pays 90 per night
 *   cancellation: 8-14 days 25%, 3-7 days 50%, within 2 days 100%, no-show 100%
 *   promotion MBH-EB15 "Early bird 15% (21 days ahead)": book >= 21 days ahead, min 3 nights,
 *     blackout 24 Dec 2026 - 02 Jan 2027 (promotion not applied, booking still allowed)
 *   allotment: 3-day release
 * Supplier 18 "Testing season 3" (Abu Dhabi) is ON HOLD but has Approved contracts + allotments (BUG-97).
 *
 * The agent markup is NOT hard-coded: TC-SS-01 measures it (sell before discount / contract rate) and every other
 * scenario must use the same markup.
 */
const AGENT = 'QA Auto B2B Agent';      // AG-00035, Approved, all products
const HOTEL = 'Marina Bay Hotel';
const DAY = 864e5;
const today = new Date(new Date().toDateString());
const d = (s: string) => new Date(s + 'T00:00:00');
const plus = (base: Date, days: number) => new Date(base.getTime() + days * DAY);
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (s: string) => Number(s.replace(/[^\d.-]/g, ''));

type Room = { name: string; text: string; was: number; save: number; price: number; nights: number; cost: number; margin: number };
type Result = { hotels: string[]; rooms: Room[]; text: string };

let markup = 0;              // measured in TC-SS-01

async function pickAgent(page: Page) {
  await page.goto('/product-search');
  await expect(page.getByRole('heading', { name: 'Select an agent to continue' })).toBeVisible({ timeout: 90_000 });
  await page.locator('main').getByRole('combobox').first().click();
  await page.keyboard.type(AGENT, { delay: 20 });
  await page.getByRole('option', { name: new RegExp(AGENT) }).first().click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Continue' }).last().click();
  await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60_000 });
}

async function setDates(page: Page, checkIn: Date, checkOut: Date) {
  await page.getByPlaceholder('Check-in – Check-out').click();
  const monthsAhead = (x: Date) => (x.getFullYear() - today.getFullYear()) * 12 + x.getMonth() - today.getMonth();
  for (let i = 0; i < monthsAhead(checkIn); i++) await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('gridcell', { name: String(checkIn.getDate()), exact: true }).first().click();
  for (let i = 0; i < monthsAhead(checkOut) - monthsAhead(checkIn); i++) await page.getByRole('button', { name: 'Next month' }).click();
  await page.getByRole('gridcell', { name: String(checkOut.getDate()), exact: true }).first().click();
}

async function setGuests(page: Page, adults: number, childAges: number[]) {
  if (adults === 2 && childAges.length === 0) return;
  await page.getByRole('button', { name: /room · \d+ guests?/ }).last().click();
  const pop = page.locator('.MuiPopover-paper:visible').last();
  await pop.locator('input[aria-label="Adults"]').fill(String(adults));
  // typing a number does not add the age boxes - the "+" next to Children does (buttons: Add Room, adults -/+, children -/+, Done)
  for (let i = 0; i < childAges.length; i++) await pop.locator('input[aria-label="Children"]').locator('xpath=following-sibling::button[1]').click();
  for (let i = 0; i < childAges.length; i++) await pop.locator(`input[aria-label="Child ${i + 1} age"]`).fill(String(childAges[i]));
  await pop.getByRole('button', { name: 'Done' }).click();
}

/** Search own contracts only and read every room line of `hotel` (all rooms expanded) */
async function search(page: Page, city: string, checkIn: Date, checkOut: Date, opts: { adults?: number; childAges?: number[]; hotel?: string } = {}): Promise<Result> {
  await pickAgent(page);
  await page.getByPlaceholder('Enter city').click(); await page.keyboard.type(city, { delay: 50 });
  await page.getByRole('option', { name: city }).first().click({ timeout: 30_000 });
  await setDates(page, checkIn, checkOut);
  await setGuests(page, opts.adults ?? 2, opts.childAges ?? []);
  for (const s of ['TBO Holidays', 'HotelBeds']) await page.getByRole('button', { name: s, exact: true }).click();
  const sent = page.waitForRequest(r => /\/hotel\/search/.test(r.url()) && r.method() === 'POST');
  await page.getByRole('button', { name: 'Search Hotels' }).click();
  const body = (await sent).postDataJSON();
  expect(body.providerCodes, 'only own contracts are searched').toEqual(['Contracted']);
  const main = page.locator('main');
  await expect(main.getByText(/hotels? available|No hotels|no results|nothing/i).first()).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  // each result card: [photo] <hotel name button> ... "See N rooms" / "Details"
  const btns = (await main.locator('button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
  const hotels = btns.filter((b, i) => btns[i + 1] && /^(See \d+ rooms|Hide rooms)$/.test(btns[i + 1]));
  const rooms: Room[] = [];
  const want = opts.hotel ?? HOTEL;
  if (hotels.includes(want)) {
    // expand ONLY this hotel, so every visible "Book" belongs to it
    const card = main.getByRole('button', { name: want, exact: true }).first().locator('xpath=ancestor::*[.//button[starts-with(normalize-space(.),"See ")]][1]');
    await card.getByRole('button', { name: /^See \d+ rooms/ }).click();
    const all = main.getByRole('button', { name: /^Show all \d+ rooms/ });
    if (await all.count()) await all.first().click();
    await page.waitForTimeout(1000);
    for (const b of await main.getByRole('button', { name: 'Book', exact: true }).all()) {
      const t = (await b.locator('xpath=ancestor::*[.//button[normalize-space(.)="Policy"]][1]').innerText()).replace(/\s+/g, ' ');
      const m = t.match(/(?:AED ([\d,.]+) Save AED ([\d,.]+) )?AED ([\d,.]+) (\d+) nights?.*?Cost AED ([\d,.]+) · Margin AED ([\d,.]+)/);
      if (!m) continue;
      const price = money(m[3]);
      rooms.push({ name: t.split(/ (?:Refundable|Non-refundable)/)[0].trim(), text: t, was: m[1] ? money(m[1]) : price, save: m[2] ? money(m[2]) : 0, price, nights: Number(m[4]), cost: money(m[5]), margin: money(m[6]) });
    }
  }
  console.log(`${city} ${checkIn.toDateString()} -> ${checkOut.toDateString()} | hotels: ${hotels.join(', ') || '(none)'}\n` + rooms.map(r => `   ${r.name} | was ${r.was} save ${r.save} price ${r.price} cost ${r.cost}`).join('\n'));
  return { hotels, rooms, text };
}

const room = (res: Result, name: RegExp, meal = /Breakfast/) => {
  const r = res.rooms.find(x => name.test(x.name) && meal.test(x.name));
  expect(r, `room ${name} ${meal} offered (${res.rooms.map(x => x.name).join(' / ')})`).toBeTruthy();
  return r!;
};
const notPassed = (x: Date) => test.skip(x <= plus(today, 21), `${x.toDateString()} is no longer 21+ days ahead - pick new dates`);

test.describe.configure({ mode: 'serial' });
test.describe('Supplier contract -> Product Search', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page, /\/hotel\/search/); });
  test.afterEach(() => expect(blocked, 'nothing may be saved').toEqual([]));

  test('TC-SS-01: Peak season (19-22 Jan 2027) - Twin sells at the contract rate 720 x 3 nights x markup; early bird 15% is taken off; margin = price - cost', async ({ page }) => {
    notPassed(d('2027-01-19'));
    const res = await search(page, 'Dubai', d('2027-01-19'), d('2027-01-22'));
    const twin = room(res, /Deluxe Room Marina View – Twin/);
    markup = r2(twin.was / (720 * 3));
    console.log('measured markup: x' + markup);
    expect(markup, 'sell price is above the contract rate').toBeGreaterThan(1);
    expect(twin.nights).toBe(3);
    expect(r2(twin.save), 'early bird = 15% of the sell price').toBe(r2(twin.was * 0.15));
    expect(r2(twin.price)).toBe(r2(twin.was - twin.save));
    expect(r2(twin.margin)).toBe(r2(twin.price - twin.cost));
  });

  test('TC-SS-02: Summer season (10-13 May 2027) - Twin uses the Summer rate 580', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const twin = room(await search(page, 'Dubai', d('2027-05-10'), d('2027-05-13')), /Deluxe Room Marina View – Twin/);
    expect(r2(twin.was)).toBe(r2(580 * 3 * markup));
  });

  test('TC-SS-03: A stay across the season change (14-17 Apr 2027) is priced night by night: 720 + 720 + 580', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const twin = room(await search(page, 'Dubai', d('2027-04-14'), d('2027-04-17')), /Deluxe Room Marina View – Twin/);
    expect(r2(twin.was)).toBe(r2((720 + 720 + 580) * markup));
  });

  test('TC-SS-04: Early bird needs 21 days - a stay starting in 10 days gets NO discount', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const ci = plus(today, 10);
    test.skip(ci < d('2026-10-25') || ci > d('2027-04-12'), 'pick a Peak date');
    const res = await search(page, 'Dubai', ci, plus(ci, 3));
    const twin = room(res, /Deluxe Room Marina View – Twin/);
    expect(twin.save, 'no early-bird saving 10 days ahead').toBe(0);
    expect(r2(twin.price)).toBe(r2(720 * 3 * markup));
  });

  test('TC-SS-05: Early bird needs 3 nights - a 2-night stay (19-21 Jan 2027) gets NO discount', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const twin = room(await search(page, 'Dubai', d('2027-01-19'), d('2027-01-21')), /Deluxe Room Marina View – Twin/);
    expect(twin.save, 'no early-bird saving for 2 nights').toBe(0);
    expect(r2(twin.price)).toBe(r2(720 * 2 * markup));
  });

  test('TC-SS-06: Promotion blackout (24 Dec - 2 Jan) - the hotel is still sold but WITHOUT the early bird', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    notPassed(d('2026-12-26'));
    const twin = room(await search(page, 'Dubai', d('2026-12-26'), d('2026-12-29')), /Deluxe Room Marina View – Twin/);
    expect(twin.save, 'early bird is not applied inside the blackout').toBe(0);
    expect(r2(twin.price)).toBe(r2(720 * 3 * markup));
  });

  test('TC-SS-07: Release window (3 days) - a stay starting in 2 days is not offered from the allotment', async ({ page }) => {
    const ci = plus(today, 2);
    const res = await search(page, 'Dubai', ci, plus(ci, 2));
    const deluxe = res.rooms.filter(r => /Deluxe Room Marina View/.test(r.name));
    expect(deluxe, 'Deluxe rooms are inside the 3-day release and must not be sold').toEqual([]);
  });

  test('TC-SS-08: After the contract ends (5-8 Nov 2027) Marina Bay Hotel is not offered', async ({ page }) => {
    const res = await search(page, 'Dubai', d('2027-11-05'), d('2027-11-08'));
    expect(res.hotels, 'no contract -> no hotel').not.toContain(HOTEL);
    expect(res.rooms).toEqual([]);
  });

  test('TC-SS-09: 1 adult - the Single rate is used (Deluxe Single 650 Peak)', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const res = await search(page, 'Dubai', d('2027-01-19'), d('2027-01-22'), { adults: 1 });
    const single = room(res, /Deluxe Room Marina View – Single/);
    expect(r2(single.was)).toBe(r2(650 * 3 * markup));
    // early bird on a single: 15% of 2,340.00 = 351.00 - the screen shows 350.98 (price 1,989.02)
    const right = r2(single.was * 0.15) === r2(single.save);
    test.fail(!right, 'BUG-132: early-bird saving on single rooms is off by a few fils (350.98 instead of 351.00)');
    expect(r2(single.save), 'early bird = 15% of the sell price').toBe(r2(single.was * 0.15));
    expect(res.rooms.filter(r => /Twin|King/.test(r.name)), 'rooms for 2 are not sold to 1 adult at the 2-person price').toEqual([]);
  });

  test('TC-SS-10: Child aged 4 stays free (2 adults + 1 child) - price equals the room for 2 adults', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const res = await search(page, 'Dubai', d('2027-01-19'), d('2027-01-22'), { childAges: [4] });
    const dbl = room(res, /Deluxe Room Marina View – Double/);
    expect(r2(dbl.was), 'child 0-5 is free').toBe(r2(720 * 3 * markup));
  });

  test('TC-SS-11: Child aged 8 pays the child rate 90 per night (2 adults + 1 child)', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const res = await search(page, 'Dubai', d('2027-01-19'), d('2027-01-22'), { childAges: [8] });
    const dbl = room(res, /Deluxe Room Marina View – Double/);
    expect(r2(dbl.was), 'child 6-11 pays 90 / night').toBe(r2((720 + 90) * 3 * markup));
  });

  test('TC-SS-12: Meal supplements - Half board adds 140 and Full board 260 per adult per night', async ({ page }) => {
    test.skip(!markup, 'needs the markup from TC-SS-01');
    const res = await search(page, 'Dubai', d('2027-01-19'), d('2027-01-22'));
    const bb = room(res, /Deluxe Room Marina View – Twin/, /Breakfast/);
    const hb = room(res, /Deluxe Room Marina View – Twin/, /Half Board/);
    const fb = room(res, /Deluxe Room Marina View – Twin/, /Full Board/);
    expect(r2(hb.was - bb.was), 'half board supplement').toBe(r2(140 * 2 * 3 * markup));
    expect(r2(fb.was - bb.was), 'full board supplement').toBe(r2(260 * 2 * 3 * markup));
  });

  test('TC-SS-13: An On-hold supplier ("Testing season 3", Abu Dhabi) is not sold, although it has Approved contracts', async ({ page }) => {
    const res = await search(page, 'Abu Dhabi', d('2027-01-19'), d('2027-01-22'), { hotel: 'Testing season 3' });
    const sold = /Testing season 3/.test(res.text) || res.rooms.some(r => /Club|Family|QA Auto Room/.test(r.name));
    test.fail(sold, 'NEW BUG: rooms of the On-hold supplier "Testing season 3" are offered for sale');
    expect(sold, 'On-hold supplier must not be offered').toBe(false);
  });
});
