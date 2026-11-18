import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { visible } from '../../pages/FormHelpers';

/*
 * PORTAL CMS (what agents see in B2B): Overview, Sponsored offers, Deal cards, Login slider, Listing layout,
 * Package options, Documents, Checkout fields, Email templates, Scheduler, Storefront.
 * SAFETY: every save is BLOCKED - nothing can change.
 */
const panel = (page: Page) => page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
async function go(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1500);
}
/** "Live · 4" -> 4 */
const count = async (page: Page, name: RegExp) => Number((await page.getByRole('tab', { name }).first().innerText()).replace(/.*·\s*/, '').trim());

test.describe('Portal CMS', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

  test('TC-CMS-01: Menu Portal CMS lists its 11 screens; Overview shows what agents see, what needs attention and the content areas @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    const nav = page.locator('nav, aside').first();
    await nav.getByRole('button', { name: 'Portal CMS', exact: true }).click({ timeout: 90_000 });
    for (const s of ['Overview', 'Sponsored Offers', 'Deal Cards', 'Login Slider', 'Listing Layout', 'Package Options', 'Documents', 'Checkout Fields', 'Email Templates', 'Scheduler', 'Storefront'])
      await expect(nav.getByRole('button', { name: s, exact: true }), s).toBeVisible();
    await go(page, '/portal-cms/overview', /^Portal CMS/);
    for (const h of ['What agents see now', 'Needs attention', 'Content areas']) await expect(page.getByRole('heading', { name: h }).first(), h).toBeVisible();
  });

  test('TC-CMS-02: Sponsored offers - tab counts add up (All = Live + Scheduled + Drafts + Ended)', async ({ page }) => {
    await go(page, '/portal-cms/offers', /^Sponsored offers/);
    const all = await count(page, /^All ·/), live = await count(page, /^Live ·/), sch = await count(page, /^Scheduled ·/), dr = await count(page, /^Drafts ·/), end = await count(page, /^Ended ·/);
    console.log({ all, live, sch, dr, end });
    expect(live + sch + dr + end).toBe(all);
  });

  test('TC-CMS-03: Sponsored offers - New offer form: Heading*, Image*, sponsor, badge, button, price, priority; Save draft / Save and publish; empty save sends nothing', async ({ page }) => {
    await go(page, '/portal-cms/offers', /^Sponsored offers/);
    await visible(page.getByRole('button', { name: 'New offer' })).click();
    const d = panel(page);
    for (const t of ['Heading', 'Subtitle', 'Sponsor', 'Badge', 'Button text', 'Image', 'From price', 'Currency', 'Per', 'Priority'])
      await expect(d.getByText(new RegExp(`^${t}\\*?$`)).first(), t).toBeVisible();
    await d.getByRole('button', { name: 'Save and publish' }).click();
    await expect(page.getByText('Give the offer a heading.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-CMS-04: Deal cards - tabs All / Home page / Search screens; New deal card needs a title', async ({ page }) => {
    await go(page, '/portal-cms/deals', /^Deal cards/);
    for (const t of [/^All ·/, /^Home page ·/, /^Search screens ·/]) await expect(page.getByRole('tab', { name: t }), String(t)).toBeVisible();
    expect(await count(page, /^Home page ·/)).toBeLessThanOrEqual(await count(page, /^All ·/));
    await visible(page.getByRole('button', { name: 'New deal card' })).click();
    await panel(page).getByRole('button', { name: 'Save and publish' }).click();
    await expect(page.getByText('Give the card a title.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-CMS-05: Login slider - empty state and "Add a photo" needs an image', async ({ page }) => {
    await go(page, '/portal-cms/slider', /^Login slider/);
    await visible(page.getByRole('button', { name: 'Add a photo' })).click();
    const d = panel(page);
    for (const t of ['Image', 'Name', 'Order']) await expect(d.getByText(new RegExp(`^${t}\\*?$`)).first(), t).toBeVisible();
    await d.getByRole('button', { name: 'Save and publish' }).click();
    await expect(page.getByText('Add a photo — upload one or paste a link.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-CMS-06: Listing layout - List / Grid per product, "Reset to default", "Give an agent their own layout"', async ({ page }) => {
    await go(page, '/portal-cms/listing', /^Listing layout/);
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Packages' })).toBeVisible();
    for (const b of ['List', 'Grid', 'Reset to default', 'Give an agent their own layout']) await expect(main.getByText(b, { exact: true }).first(), b).toBeVisible();
    await expect(page.getByRole('switch', { name: /Agents may switch between list and grid/ }).first()).toBeVisible();
  });

  test('TC-CMS-07: Package options - each package says how many parts agents may change, and each part has its own switch', async ({ page }) => {
    await go(page, '/portal-cms/packages', /^Package options/);
    const pkgs = page.locator('main').getByRole('button', { name: /\d+ of \d+ changeable by agents/ });
    expect(await pkgs.count()).toBeGreaterThan(0);
    const label = await pkgs.first().innerText();
    const [, on, all] = label.match(/(\d+) of (\d+) changeable/)!.map(Number);
    await pkgs.first().click();
    await page.waitForTimeout(1500);
    const sw = page.locator('main input[type=checkbox][aria-label$="agents may change it"]');
    console.log(`${label.replace(/\s+/g, ' ')} -> switches ${await sw.count()}, on ${(await sw.evaluateAll(e => e.filter(x => (x as HTMLInputElement).checked).length))}`);
    expect(await sw.count()).toBe(all);
    expect(await sw.evaluateAll(e => e.filter(x => (x as HTMLInputElement).checked).length)).toBe(on);
  });

  test('TC-CMS-08: Documents - tabs Documents / Headers & footers / Portal itinerary & quote view; built-in documents can be customised', async ({ page }) => {
    await go(page, '/portal-cms/documents', /^Documents/);
    for (const t of ['Headers & footers', 'Portal itinerary & quote view']) await expect(page.getByRole('tab', { name: t }), t).toBeVisible();
    await expect(page.locator('main thead th:visible')).toContainText(['Document', 'Template', 'Language', 'Header / footer', 'Status', 'Actions']);
    for (const d of ['Itinerary', 'Quotation / proposal', 'Customer invoice']) await expect(page.locator('main tbody tr', { hasText: d }).first(), d).toBeVisible();
    await expect(page.locator('main').getByText('Customise', { exact: true }).first()).toBeVisible();
    expect(await page.locator('main').getByText('Customise', { exact: true }).count()).toBeGreaterThanOrEqual(10);
  });

  test('TC-CMS-09: Checkout fields - every product lists its field count; opening Hotel shows that many fields', async ({ page }) => {
    await go(page, '/portal-cms/checkout', /^Checkout fields/);
    const main = page.locator('main');
    for (const p of ['Lead contact', 'Flight', 'Hotel', 'Activity', 'Transfer', 'Visa', 'Cruise', 'Rail', 'Self drive', 'Package'])
      await expect(main.getByRole('button', { name: new RegExp(`^${p} \\d+ fields`) }), p).toBeVisible();
    const hotel = main.getByRole('button', { name: /^Hotel \d+ fields/ });
    const n = Number((await hotel.innerText()).match(/(\d+) fields/)![1]);
    await hotel.click(); await page.waitForTimeout(1500);
    const labels = main.locator('input[aria-label="Label"], input[placeholder="Label"]');
    console.log(`Hotel says ${n} fields, shows ${await labels.count()}`);
    expect(await labels.count()).toBe(n);
  });

  test('TC-CMS-10: Checkout fields - "Add field" needs a label ("Give the field a label.") and sends nothing', async ({ page }) => {
    await go(page, '/portal-cms/checkout', /^Checkout fields/);
    await visible(page.getByRole('button', { name: 'Add field' })).click();
    const d = panel(page);
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(d.getByText('Give the field a label.')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-CMS-11: Email templates - header & footer plus booking / quotation / feedback / welcome templates, each Built-in or customised', async ({ page }) => {
    await go(page, '/portal-cms/emails', /^Email templates/);
    const main = page.locator('main');
    for (const t of ['Header & footer', 'Booking confirmed', 'Booking update', 'Quotation sent', 'Quotation follow-up', 'Feedback request', 'Welcome — new agent'])
      await expect(main.getByRole('button', { name: new RegExp('^' + t) }).first(), t).toBeVisible();
    await expect(page.getByText('Subject*').or(page.getByText(/^Subject/)).first()).toBeVisible();
  });

  test('TC-CMS-12: Scheduler page loads with content (not blank)', async ({ page }) => {
    await go(page, '/portal-cms/scheduler', /^Scheduler/);
    // the page first shows grey loading placeholders - give it a minute to fill in
    await expect(page.locator('main .MuiSkeleton-root:visible').first(), 'still loading after 60 s').toBeHidden({ timeout: 60_000 });
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ').replace(/Nexgenpilot © .*$/, '').trim();
    console.log('scheduler: ' + text.slice(0, 300));
    expect(text.length, 'Scheduler shows only its heading').toBeGreaterThan('Scheduler'.length + 20);
  });

  test('TC-CMS-13: Storefront - tabs Hero / Offers / Routes / Destinations / Hotels / Testimonials / Why book & trust / Pages / SEO / Settings; "Add a slide" needs a heading', async ({ page }) => {
    await go(page, '/portal-cms/storefront', /^Storefront/);
    for (const t of ['Hero', 'Offers', 'Routes', 'Destinations', 'Hotels', 'Testimonials', 'Why book & trust', 'Pages', 'SEO', 'Settings'])
      await expect(page.getByRole('tab', { name: new RegExp(`^${t.replace('&', '\\&')} \\d+$`) }), t).toBeVisible();
    await visible(page.getByRole('button', { name: 'Add a slide' })).click();
    await panel(page).getByRole('button', { name: 'Save and publish' }).click();
    await expect(page.getByText('Give the slide a heading.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });
});

test.describe('Company and Product Search', () => {
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('TC-CMP-01: Company list shows the one company "Sandbox" with its e-mail and Active switch @smoke', async ({ page }) => {
    await go(page, '/companies', /^Companies/);
    const row = page.locator('main tbody tr', { hasText: 'Sandbox' });
    await expect(row).toBeVisible();
    await expect(row.locator('input[type=checkbox]')).toBeChecked();
  });

  test('TC-CMP-02: Company "Sandbox" - tabs Overview / Mapping / Payment Settings / Portal; code SB; read-only until Edit', async ({ page }) => {
    await page.goto('/companies/2');
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 90_000 });
    for (const t of ['Mapping', 'Payment Settings', 'Portal']) await expect(page.getByRole('tab', { name: t }), t).toBeVisible();
    await expect(page.locator('main input[value="SB"]').first()).toBeVisible();
    await expect(visible(page.getByRole('button', { name: 'Edit', exact: true }))).toBeVisible();
  });

  test('TC-PS-01: Product Search first asks for an agent; Continue needs one', async ({ page }) => {
    await go(page, '/product-search', /^Product Search/);
    await expect(page.getByRole('heading', { name: 'Select an agent to continue' })).toBeVisible();
    const cont = visible(page.getByRole('button', { name: 'Continue' }));
    await expect(cont).toBeDisabled();
  });

  test('TC-PS-02: Product Search agent list offers only agents that may book (no Blocked agents)', async ({ page }) => {
    await go(page, '/product-search', /^Product Search/);
    const box = page.getByRole('combobox').or(page.getByPlaceholder('Agent')).first();
    await box.click();
    await page.keyboard.type('QA Auto Agent', { delay: 30 });
    await page.waitForTimeout(2500);
    const offered = (await page.getByRole('option').allInnerTexts()).map(s => s.trim()).filter(s => s.startsWith('QA Auto Agent'));
    console.log('QA agents offered: ' + JSON.stringify(offered));
    test.fail(offered.length > 0, 'BUG-107: Blocked agents are offered (same as Add Quote / Add Reservation)');
    expect(offered).toEqual([]);
  });
});
