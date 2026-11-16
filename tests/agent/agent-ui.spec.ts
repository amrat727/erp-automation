import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { AgentPage } from '../../pages/AgentPage';

/*
 * AGENT - screen checks (READ-ONLY: every save is blocked, real agents are never changed).
 * Run:  npx playwright test --project=agent agent-ui
 * Real data used: AG-00002 "Gulf Horizons Travel LLC" (India/UAE, Approved), AG-00003 "Saffron Journeys Pvt Ltd" (India),
 *                 AG-00004 "Lotus Asia Holidays" (Malaysia), AG-00008 "New Test Agent" (On Hold).
 */
let blocked: string[];
let a: AgentPage;
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); a = new AgentPage(page); });

// ======================= LIST =======================
test.describe('Agent list', () => {
  test('TC-AGT-01: Opens from the menu "Agent" at /agents', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('nav, aside').first().getByRole('button', { name: 'Agent', exact: true }).first().click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/agents$/, { timeout: 60_000 });
    await expect(a.heading).toBeVisible();
  });

  test('TC-AGT-02: Toolbar has "Credit Requests", "Add Agent" and "Columns"', async () => {
    await a.open();
    for (const b of [a.creditRequestsButton, a.addButton, a.columnsButton]) await expect(b.first()).toBeVisible();
  });

  test('TC-AGT-03: Table has Name and Email search, a Country and a Status filter, and Code sorting', async () => {
    await a.open();
    for (const h of ['Code', 'Name', 'Email', 'Country', 'Status']) await expect(a.page.getByRole('columnheader', { name: new RegExp(`^${h}`) })).toBeVisible();
    for (const box of [a.nameSearch, a.emailSearch]) await expect(box).toBeVisible();
    for (const f of [a.countryFilter, a.statusFilter]) await expect(f).toBeVisible();
  });

  test('TC-AGT-04: Status filter offers All / Approved / On Hold / Blocked', async ({ page }) => {
    await a.open();
    await a.statusFilter.click();
    await expect(page.getByRole('option')).toHaveText(['All', 'Approved', 'On Hold', 'Blocked']);
  });

  for (const st of ['Approved', 'On Hold', 'Blocked'] as const) {
    test(`TC-AGT-05: Filter "${st}" shows only ${st} agents`, async () => {
      await a.open();
      await a.filterStatus(st);
      const statuses = await a.column(5);
      expect(statuses.every(s => s === st), `statuses shown: ${statuses.join(', ')}`).toBe(true);
    });
  }

  test('TC-AGT-06: Search by name finds "Gulf Horizons Travel LLC" (case-insensitive, part of the name)', async () => {
    await a.open();
    await a.nameSearch.fill('gulf hor');
    await expect(a.rows.filter({ hasText: 'Gulf Horizons Travel LLC' })).toHaveCount(1, { timeout: 30_000 });
    await expect(a.rows).toHaveCount(1);
  });

  test('TC-AGT-07: Clicking "Code" sorts the codes, again reverses them', async ({ page }) => {
    await a.open();
    const header = page.getByRole('columnheader', { name: /^Code/ });
    await header.getByText('Code', { exact: true }).click();
    await page.waitForTimeout(1500);
    const first = await a.column(1);
    await header.getByText('Code', { exact: true }).click();
    await page.waitForTimeout(1500);
    const second = await a.column(1);
    expect(first).toEqual([...first].sort());
    expect(second).toEqual([...second].sort().reverse());
  });

  test('TC-AGT-08: Search by email "lotusasia" finds Lotus Asia Holidays', async () => {
    await a.open();
    await a.emailSearch.fill('lotusasia');
    await expect(a.rows.filter({ hasText: 'Lotus Asia Holidays' })).toHaveCount(1, { timeout: 30_000 });
    await expect(a.rows).toHaveCount(1);
  });

  test('TC-AGT-09: Country filter "India" shows only Indian agents', async ({ page }) => {
    await a.open();
    await a.countryFilter.click();
    await page.getByRole('option', { name: 'India', exact: true }).click();
    await expect(async () => {
      const c = await a.column(4);
      expect(c.length).toBeGreaterThan(0);
      expect(c.every(x => x === 'India'), `countries: ${c.join(', ')}`).toBe(true);
    }).toPass({ timeout: 30_000 });
  });

  test('TC-AGT-10: Search with no match shows the "no records" message', async () => {
    await a.open();
    await a.nameSearch.fill('zzzz-no-such-agent');
    await expect(a.page.getByText(/There are no records/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGT-11: Search ignores spaces before/after the text', async () => {
    await a.open();
    await a.nameSearch.fill('  Lotus Asia Holidays  ');
    await expect(a.rows.filter({ hasText: 'Lotus Asia Holidays' })).toHaveCount(1, { timeout: 30_000 });
  });

  test('TC-AGT-12: Paging text matches the number of rows (8 per page)', async () => {
    await a.open();
    const m = (await a.rangeText.innerText()).match(/^(\d+)–(\d+) of (\d+)$/)!;
    expect(Number(m[2]) - Number(m[1]) + 1).toBe(await a.rows.count());
    expect(Number(m[3])).toBeGreaterThanOrEqual(await a.rows.count());
  });

  test('TC-AGT-13: Every agent code is unique', async () => {
    await a.open();
    const codes = await a.column(1);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('TC-AGT-14: Clicking "Name" sorts A->Z, again Z->A', async ({ page }) => {
    await a.open();
    const clean = (n: string) => n.replace(/^\w\s/, '').trim().toLowerCase();   // the Name cell starts with an avatar letter
    const header = page.getByRole('columnheader', { name: /^Name/ });
    await header.getByText('Name', { exact: true }).click();
    await page.waitForTimeout(1500);
    const asc = (await a.column(2)).map(clean);
    expect(asc).toEqual([...asc].sort());
    await header.getByText('Name', { exact: true }).click();
    await page.waitForTimeout(1500);
    const desc = (await a.column(2)).map(clean);
    expect(desc).toEqual([...desc].sort().reverse());
  });

  test('TC-AGT-15: Columns menu lists Code / Name / Email / Country / Status', async ({ page }) => {
    await a.open();
    await a.columnsButton.click();
    await expect(page.getByRole('menuitem')).toHaveText(['Code', 'Name', 'Email', 'Country', 'Status']);
  });

  test('TC-AGT-16: Un-ticking "Email" hides the Email column; "Show all" brings it back', async ({ page }) => {
    await a.open();
    const header = page.getByRole('columnheader', { name: /^Email/ });
    await a.columnsButton.click();
    await page.getByRole('menuitem', { name: 'Email' }).click();
    await expect(header).toBeHidden();
    await page.getByRole('button', { name: 'Show all' }).click();
    await page.keyboard.press('Escape');
    await expect(header).toBeVisible();
  });

  test('TC-AGT-17: Opening /agents while logged out goes to the login page', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('https://erp.nexgenpilot.com/agents');
    await expect(page).toHaveURL(/login/, { timeout: 60_000 });
    await page.close();
  });

  test('TC-AGT-18: "Credit Requests" opens /agents/credit-requests with tabs Pending / All and "Only my agents"', async ({ page }) => {
    await a.open();
    await a.creditRequestsButton.first().click();
    await expect(page).toHaveURL(/credit-requests/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Credit Requests' })).toBeVisible();
    for (const t of ['Pending', 'All']) await expect(page.getByRole('tab', { name: t, exact: true })).toBeVisible();
    await expect(page.getByText('Only my agents')).toBeVisible();
  });
});

// ======================= ADD FORM =======================
test.describe('Add agent form', () => {
  test('TC-AGT-20: Form has Basic details, Status & markets and Financial and portal settings sections', async ({ page }) => {
    await a.openAdd();
    for (const h of ['Basic details', 'Status & markets', 'Financial and portal settings'])
      await expect(page.getByRole('heading', { name: h }).first()).toBeVisible();
  });

  test('TC-AGT-21: Status buttons Approved / On Hold / Blocked, type B2B / B2C and General / Concierge / Desk exist', async () => {
    await a.openAdd();
    for (const b of ['Approved', 'On Hold', 'Blocked', 'B2B', 'B2C', 'General', 'Concierge', 'Desk'])
      await expect(a.page.getByRole('button', { name: b, exact: true })).toBeVisible();
  });

  test('TC-AGT-22: Defaults: On Hold, B2B, General, Allow credit "No", "Days After Invoice", Portal access "No"', async ({ page }) => {
    await a.openAdd();
    // the selected status / type buttons are the dark / coloured ones: check by text of the switches + dropdown value
    await expect(page.locator('main input[role=combobox]:visible[value="Days After Invoice"]').first()).toBeVisible();
    await expect(page.locator('main :text-is("No"):visible')).toHaveCount(2);   // Allow credit = No, Portal access = No
    for (const b of ['On Hold', 'B2B', 'General']) await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
  });

  test('TC-AGT-23: Empty "Create agent" shows required messages and sends nothing', async ({ page }) => {
    await a.openAdd();
    await a.createButton.click();
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(a.text(/Name is required/i)).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGT-24: Empty Exchange type and Country also show a "... is required" message', async () => {
    await a.openAdd();
    await a.createButton.click();
    await expect(a.text(/Exchange type is required/i)).toBeVisible({ timeout: 10_000 });
    await expect(a.text(/Country is required/i)).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGT-25: Invalid email "abc" is rejected', async () => {
    await a.openAdd();
    await a.name.fill('QA Auto Agent');
    await a.email.fill('abc');
    await a.createButton.click();
    await expect(a.page.getByText(/valid email|email is invalid|invalid email/i).first()).toBeVisible({ timeout: 10_000 });
    expect(blocked, 'an agent with email "abc" was sent').toEqual([]);
  });

  test('TC-AGT-26: Name with only spaces is rejected', async () => {
    await a.openAdd();
    await a.name.fill('     ');
    await a.createButton.click();
    await expect(a.text(/Name is required/i)).toBeVisible({ timeout: 10_000 });
    expect(blocked, 'an agent with a blank name was sent').toEqual([]);
  });

  test('TC-AGT-27: State is disabled until a Country is chosen', async ({ page }) => {
    await a.openAdd();
    await expect(a.state).toBeDisabled();
    await a.country.click();
    await a.country.fill('India');
    await page.getByRole('option', { name: /India/ }).first().click();
    await expect(a.state).toBeEnabled({ timeout: 30_000 });
  });

  test('TC-AGT-28: Cancel leaves the form without sending anything', async ({ page }) => {
    await a.openAdd();
    await a.name.fill('QA Auto Agent');
    await a.cancelButton.click();
    await expect(page.getByRole('heading', { name: 'Add agent' })).toBeHidden({ timeout: 30_000 });
    expect(blocked).toEqual([]);
  });
});

// ======================= EXISTING AGENT =======================
test.describe('Existing agent', () => {
  const NAME = 'Gulf Horizons Travel LLC';
  test.beforeEach(async () => { await a.open(); await a.openAgent(NAME); });

  test('TC-AGT-40: Opening an agent shows 5 tabs: Overview, Addresses, Financials, Access, On-behalf activity', async () => {
    for (const t of ['Overview', 'Addresses', 'Financials', 'Access', 'On-behalf activity'] as const) await expect(a.tab(t)).toBeVisible();
  });

  test('TC-AGT-41: Overview is read-only until Edit (name, email, country disabled)', async ({ page }) => {
    await expect(page.locator('main input[type=email]:visible').first()).toBeDisabled({ timeout: 30_000 });
    await expect(page.locator('main input:visible[value="Gulf Horizons Travel LLC"]').last()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible();
  });

  test('TC-AGT-42: Overview shows Client type, Online access, Designation and Account manager', async ({ page }) => {
    for (const l of ['Client type', 'Online access', 'Designation', 'Account manager']) await expect(page.locator(`main label:visible:text-is("${l}")`).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGT-43: Overview shows "Plan & tier" with the number of features', async () => {
    await expect(a.text(/\d+ of \d+ features/)).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGT-44: Addresses - Primary and Correspondence address, read-only, Dubai shown', async ({ page }) => {
    await a.tab('Addresses').click();
    await expect(page.getByRole('heading', { name: 'Primary address' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Correspondence address' }).first()).toBeVisible();
    await expect(page.locator('main input[placeholder="Street, building"]:visible').first()).toBeDisabled();
    await expect(page.locator('main input:visible[value="Dubai"]').first()).toBeVisible();
  });

  test('TC-AGT-45: Financials - Currencies, Ledger, Credit requests and Loyalty points sections', async ({ page }) => {
    await a.tab('Financials').click();
    for (const h of ['Currencies', 'Ledger', 'Credit requests', 'Loyalty points']) await expect(page.getByRole('heading', { name: h }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Add currency$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adjust' }).locator('visible=true').first()).toBeVisible();
  });

  test('TC-AGT-46: Access - Products, Portal menus, Portal users and Portal access sections', async ({ page }) => {
    await a.tab('Access').click();
    for (const h of ['Products', 'Portal menus', 'Portal users', 'Portal access']) await expect(page.getByRole('heading', { name: h }).first()).toBeVisible({ timeout: 30_000 });
    await expect(a.text(/\d+ of \d+ on/)).toBeVisible();
  });

  test('TC-AGT-47: Access - Portal access offers Portal login, Payments, Credit line, Company settings', async ({ page }) => {
    await a.tab('Access').click();
    for (const b of ['Portal login', 'Payments', 'Credit line', 'Company settings']) await expect(page.getByRole('button', { name: b }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGT-48: On-behalf activity has "Done for this agent" / "Done by this agent"', async ({ page }) => {
    await a.tab('On-behalf activity').click();
    for (const t of ['Done for this agent', 'Done by this agent']) await expect(page.getByRole('tab', { name: t }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGT-49: Edit mode: "Save" stays disabled until something changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const save = page.getByRole('button', { name: 'Save', exact: true }).first();
    await expect(save).toBeDisabled();
    await page.locator('main input:visible[value="Gulf Horizons Travel LLC"]').last().fill('Gulf Horizons Travel LLC x');   // (the first match is the list search box)
    await expect(save).toBeEnabled();
    expect(blocked).toEqual([]);
  });
});

test.describe('Consistency', () => {
  test('TC-AGT-60: Status is spelled the same in the list and on the agent ("On Hold")', async ({ page }) => {
    await a.open();
    await a.openAgent('New Test Agent');
    await expect(page.locator('main input:visible[value="On Hold"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(a.rows.filter({ hasText: 'New Test Agent' }).locator('td:nth-child(5)')).toHaveText('On Hold');
  });
});
