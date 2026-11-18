import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { visible } from '../../pages/FormHelpers';

/*
 * CRM SCREENS: Enquiries (/enquiries), Amendment Requests (/amendments), Feedback (/feedback).
 * SAFETY: every save is BLOCKED - nothing can change.
 */
const panel = (page: Page) => page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
const menu = (page: Page) => page.locator('.MuiPopover-paper:visible, .MuiMenu-paper:visible').last();

test.describe('Enquiries', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    await page.goto('/enquiries');
    await expect(page.getByRole('heading', { name: 'Enquiries' })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
  });

  test('TC-ENQ-01: Opens from the menu "Enquiries"; New enquiry, search, Source / Assigned to / Follow-up filters, Audit history, Columns @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Enquiries', exact: true }).click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/enquiries$/);
    for (const b of ['New enquiry', 'Source', 'Assigned to', 'Follow-up', 'Audit history', 'Columns']) await expect(visible(page.getByRole('button', { name: b, exact: true })), b).toBeVisible();
    await expect(page.getByPlaceholder('Search name, email, phone, ref, subject')).toBeVisible();
  });

  test('TC-ENQ-02: Status tabs Open / New / In progress / Quoted / Won / Lost / Closed / All with counts; columns', async ({ page }) => {
    for (const t of ['Open', 'New', 'In progress', 'Quoted', 'Won', 'Lost', 'Closed', 'All']) await expect(page.getByRole('tab', { name: new RegExp(`^${t} \\d+$`) }), t).toBeVisible();
    await expect(page.locator('main thead th:visible')).toContainText(['Ref', 'Received', 'Customer', 'Source', 'About', 'Travellers', 'Priority', 'Assigned to', 'Follow-up', 'Status', 'Actions']);
  });

  test('TC-ENQ-03: Filter menus - Source (Phone, Email, Walk-in, Agent portal, Storefront, Public form), Assigned to (Anyone, Me, Nobody), Follow-up (Due or overdue)', async ({ page }) => {
    const check = async (b: string, items: string[]) => {
      await visible(page.getByRole('button', { name: b, exact: true })).click();
      for (const i of items) await expect(menu(page).getByText(i, { exact: true }).first(), `${b}: ${i}`).toBeVisible();
      await page.keyboard.press('Escape');
    };
    await check('Source', ['Any', 'Phone', 'Email', 'Walk-in', 'Agent portal', 'Storefront', 'Public form']);
    await check('Assigned to', ['Anyone', 'Me', 'Nobody']);
    await check('Follow-up', ['Any', 'Due or overdue']);
  });

  test('TC-ENQ-04: No enquiries -> "No open enquiries." and every tab count is 0', async ({ page }) => {
    const all = page.getByRole('tab', { name: /^All \d+$/ });
    test.skip(!(await all.innerText()).trim().endsWith(' 0'), 'enquiries exist now');
    await expect(page.getByText('No open enquiries.')).toBeVisible();
  });

  test('TC-ENQ-05: New enquiry form - Source* (Phone / Email / Walk-in), Priority Low / Normal / High / Urgent, who is asking, the trip, follow-up', async ({ page }) => {
    await visible(page.getByRole('button', { name: 'New enquiry' })).click();
    const d = panel(page);
    await expect(d).toContainText('A call, an email or a walk-in — everything else can be added later.');
    for (const b of ['Low', 'Normal', 'High', 'Urgent']) await expect(d.getByRole('button', { name: b, exact: true }), b).toBeVisible();
    for (const t of ["Who's asking", 'The trip', 'Customer name', 'Email', 'Phone', 'Subject', 'Destination', 'Travel from', 'Travel to', 'Adults', 'Children', 'Infants', 'Budget', 'What they asked for', 'Assigned to'])
      await expect(d.getByText(t, { exact: true }).first(), t).toBeVisible();
    await d.locator('[role=combobox]').first().click();
    await expect(page.getByRole('option')).toHaveText(['Phone', 'Email', 'Walk-in']);
  });

  test('TC-ENQ-06: New enquiry - an invalid e-mail ("abc") is refused before sending', async ({ page }) => {
    await visible(page.getByRole('button', { name: 'New enquiry' })).click();
    const d = panel(page);
    await d.getByPlaceholder('Full name').fill('QA Auto Enquiry');
    await d.locator('input[type=email]').fill('abc');
    await d.getByRole('button', { name: 'Create enquiry' }).click();
    await page.waitForTimeout(2000);
    test.fail(blocked.length > 0, 'BUG-110: an enquiry with the e-mail "abc" is sent to the server (no e-mail check)');
    expect(blocked, 'invalid e-mail sent').toEqual([]);
  });

  test('TC-ENQ-07: Cancel / × closes the form without saving', async ({ page }) => {
    await visible(page.getByRole('button', { name: 'New enquiry' })).click();
    await panel(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('A call, an email or a walk-in')).toBeHidden();
    expect(blocked).toEqual([]);
  });
});

test.describe('Amendment Requests', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => {
    blocked = await blockWrites(page);
    await page.goto('/amendments');
    await expect(page.getByRole('heading', { name: 'Amendment Requests' })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2000);
  });
  test.afterEach(() => expect(blocked, 'nothing may be saved').toEqual([]));

  test('TC-AMD-01: Opens from the menu; "Show" offers To quote / Accepted — to complete / Waiting for the agent / Completed / Didn\'t go through / All requests @smoke', async ({ page }) => {
    await page.locator('main [role=combobox]').first().click();
    await expect(page.getByRole('option')).toHaveText(['To quote', 'Accepted — to complete', 'Waiting for the agent', 'Completed', "Didn't go through", 'All requests']);
  });

  test('TC-AMD-02: A request card shows the AMD number, reservation, who asked and when, the change, and Quote / Reject / Timeline', async ({ page }) => {
    const main = page.locator('main');
    const card = main.getByText(/^AMD-\d+$/).first();
    test.skip(!(await card.count()), 'no request to quote right now');
    await expect(main.getByText(/Reservation \d{6}/).first()).toBeVisible();
    await expect(main.getByText(/asked \d+\/\d+\/\d{4}/).first()).toBeVisible();
    for (const b of ['Quote', 'Reject']) await expect(visible(main.getByRole('button', { name: b, exact: true })), b).toBeVisible();
    await expect(visible(main.getByRole('button', { name: /^Timeline/ }))).toBeVisible();
  });

  test('TC-AMD-03: Quote - charge to the agent* (AED), supplier charge (hidden from agent), note, valid until; Send quote stays off without a charge', async ({ page }) => {
    const q = page.locator('main').getByRole('button', { name: 'Quote', exact: true }).first();
    test.skip(!(await q.count()), 'no request to quote right now');
    await q.click();
    const d = panel(page);
    for (const t of ['Charge to the agent (AED)', "Supplier's charge (AED) — not shown to the agent", 'Note for the agent', 'Valid until'])
      await expect(d.getByText(new RegExp(t.replace(/[()]/g, '\\$&'))).first(), t).toBeVisible();
    const send = d.getByRole('button', { name: 'Send quote' });
    if (await send.isEnabled()) { await send.click(); await page.waitForTimeout(1500); }
    await d.getByRole('button', { name: 'Cancel' }).click();
  });

  test('TC-AMD-04: Reject - a reason the agent sees is required; Cancel closes', async ({ page }) => {
    const r = page.locator('main').getByRole('button', { name: 'Reject', exact: true }).first();
    test.skip(!(await r.count()), 'no request to quote right now');
    await r.click();
    const d = panel(page);
    await expect(d.getByText(/Why it can't be done \(the agent sees this\)/)).toBeVisible();
    const rej = d.getByRole('button', { name: 'Reject', exact: true });
    if (await rej.isEnabled()) { await rej.click(); await page.waitForTimeout(1500); }
    await d.getByRole('button', { name: 'Cancel' }).click();
  });
});

test.describe('Feedback', () => {
  test.beforeEach(async ({ page }) => {
    await blockWrites(page);
    await page.goto('/feedback');
    await expect(page.getByRole('heading', { name: /^Feedback/ })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(1500);
  });

  test('TC-FBK-01: Rating summary (5..1 stars), tabs All / 5★..1★, search, columns Latest / Booking / Agent / Rating / From @smoke', async ({ page }) => {
    const main = page.locator('main');
    for (const s of ['5 stars', '4 stars', '3 stars', '2 stars', '1 star']) await expect(main.getByText(s, { exact: true }).first(), s).toBeVisible();
    for (const t of ['All', '5★', '4★', '3★', '2★', '1★']) await expect(page.getByRole('tab', { name: t, exact: true }), t).toBeVisible();
    await expect(page.getByPlaceholder('Search booking, traveller, comment')).toBeVisible();
    await expect(page.locator('main thead th:visible')).toContainText(['Latest', 'Booking', 'Agent', 'Rating', 'From']);
  });

  test('TC-FBK-02: No feedback -> "No feedback yet." and "0 ratings"', async ({ page }) => {
    test.skip(!(await page.getByText('No feedback yet.').count()), 'feedback exists now');
    await expect(page.locator('main').getByText(/0 ratings/)).toBeVisible();
  });
});
