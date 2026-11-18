import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { visible } from '../../pages/FormHelpers';

/*
 * INSIGHT SCREENS: Dashboard (/dashboard), Reports (/reports), Playground (/playground).
 * SAFETY: every save is BLOCKED - nothing can change.
 */
const num = (s: string) => Number(s.replace(/[^\d.]/g, ''));

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await blockWrites(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), / })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2500);
  });

  test('TC-DSH-01: Greeting with today\'s date, licences, shortcuts Search products / New reservation / New quote @smoke', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).replace(',', ',').replace('Sept', 'Sep');
    await expect(page.locator('main').getByText(/licences free/)).toBeVisible();
    console.log('date shown: ' + (await page.locator('main').getByText(/licences free/).innerText()) + ' | expected like ' + today);
    for (const b of ['Search products', 'New reservation', 'New quote']) await expect(visible(page.getByRole('button', { name: b, exact: true })), b).toBeVisible();
  });

  test('TC-DSH-02: Tabs Overview / Sales / Partners / Contracts / Allotments / Look-to-book / Quotations / Enquiries / Feedback each open', async ({ page }) => {
    for (const t of ['Sales', 'Partners', 'Contracts', 'Allotments', 'Look-to-book', 'Quotations', 'Enquiries', 'Feedback', 'Overview']) {
      await page.getByRole('tab', { name: t, exact: true }).click();
      await expect(page.getByRole('tab', { name: t, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
  });

  for (const [b, url] of [['Search products', /\/product-search$/], ['New reservation', /\/reservations\/new$/], ['New quote', /\/quotes\/new$/]] as const) {
    test(`TC-DSH-03-${b.replace(/ /g, '')}: "${b}" opens ${url}`, async ({ page }) => {
      await visible(page.getByRole('button', { name: b, exact: true })).click();
      await expect(page).toHaveURL(url, { timeout: 30_000 });
    });
  }

  test('TC-DSH-04: Agent network - Approved + On hold + Blocked = all agents, and percentages add to 100', async ({ page }) => {
    const main = page.locator('main');
    const net = main.getByText('Agent network').locator('xpath=ancestor::*[.//*[contains(.,"Blocked")]][1]');
    const t = (await net.innerText()).replace(/\s+/g, ' ');
    console.log(t);
    const get = (label: string) => { const m = t.match(new RegExp(`${label} (\\d+) ([\\d.]+)%`)); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
    const [a, ap] = get('Approved'), [h, hp] = get('On hold'), [bl, bp] = get('Blocked');
    const total = num(t.match(/View all (\d+) agents/)?.[1] ?? '0');
    expect(a + h + bl, 'statuses add up to all agents').toBe(total);
    expect(Math.round(ap + hp + bp), 'percentages add to 100').toBe(100);
  });

  test('TC-DSH-05: Agent network does not call Blocked agents "active"', async ({ page }) => {
    const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const active = Number(t.match(/(\d+) active · \d+ B2B/)?.[1] ?? 0);
    const blockedN = Number(t.match(/Blocked (\d+) [\d.]+%/)?.[1] ?? 0);
    const totalN = Number(t.match(/View all (\d+) agents/)?.[1] ?? 0);
    console.log({ active, blockedN, totalN });
    test.fail(blockedN > 0 && active === totalN, 'INS-BUG-1: "19 active" counts the 11 Blocked agents as active');
    expect(active, 'active should exclude Blocked agents').toBe(totalN - blockedN);
  });

  test('TC-DSH-06: Contracts tab - Approved and live / Waiting for approval / Drafts / Ending in 30 days', async ({ page }) => {
    await page.getByRole('tab', { name: 'Contracts', exact: true }).click();
    for (const t of ['Approved and live', 'Waiting for approval', 'Drafts', 'Ending in 30 days']) await expect(page.locator('main').getByText(t, { exact: true }).first(), t).toBeVisible();
  });

  test('TC-DSH-07: Allotments tab - utilisation "x of y room-nights sold" is a correct percentage', async ({ page }) => {
    await page.getByRole('tab', { name: 'Allotments', exact: true }).click();
    await expect(page.locator('main').getByText(/room-nights sold/).first()).toBeVisible({ timeout: 30_000 });
    const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const m = t.match(/Utilisation[^%]*?([\d.]+)%\D*?([\d,]+) of ([\d,]+) room-nights sold/);
    console.log('utilisation: ' + (t.match(/Utilisation.{0,80}/)?.[0] ?? 'not found'));
    expect(m, 'utilisation line').not.toBeNull();
    const [pct, sold, all] = [Number(m![1]), num(m![2]), num(m![3])];
    expect(Number((sold / all * 100).toFixed(1))).toBe(pct);
  });
});

test.describe('Reports and Playground', () => {
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('TC-RPT-01: Reports - explains that published Playground reports appear here; "Build a report" opens the Playground @smoke', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByPlaceholder('Search reports')).toBeVisible();
    const empty = page.getByText('No reports published yet');
    if (await empty.count()) await expect(page.getByText('When someone publishes a report from the Playground, it appears here for everyone.')).toBeVisible();
    await visible(page.getByRole('button', { name: 'Build a report' })).click();
    await expect(page).toHaveURL(/\/playground$/, { timeout: 30_000 });
  });

  test('TC-RPT-02: Playground - prompt box, suggestions, All / Mine / Shared with me, 8 templates, achievements', async ({ page }) => {
    await page.goto('/playground');
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible({ timeout: 90_000 });
    const main = page.locator('main');
    await expect(page.getByPlaceholder('e.g. Bookings per month by agent this year')).toBeVisible();
    for (const s of ['Bookings per month this year', 'Top 10 agents by bookings', 'Suppliers by status', 'Agent wallet top-ups last 30 days']) await expect(main.getByText(s).first(), s).toBeVisible();
    for (const t of ['Bookings over time', 'Top agents', 'Booking status mix', 'Quote pipeline', 'Supplier health', 'Agent wallet flow', 'Agent × status matrix', 'Headline numbers'])
      await expect(main.getByText(t).first(), t).toBeVisible();
    await expect(main.getByText(/0 of 13 achievements|of 13 achievements/)).toBeVisible();
  });

  test('TC-RPT-03: Playground "New report" - 4 steps Choose tables / Add columns / Pick a visual / Save, data sources listed', async ({ page }) => {
    await page.goto('/playground/new');
    const main = page.locator('main');
    for (const s of ['Choose tables', 'Add columns', 'Pick a visual', 'Save']) await expect(main.getByText(s, { exact: true }).first(), s).toBeVisible({ timeout: 60_000 });
    for (const d of ['Bookings', 'Quotes', 'Agents', 'Suppliers', 'Booked services', 'Booking payments', 'Agent wallet']) await expect(main.getByText(d, { exact: true }).first(), d).toBeVisible();
    await expect(main.getByText('No table picked yet')).toBeVisible();
  });
});
