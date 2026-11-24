import { test, expect } from '../../fixtures';
import { Page, Locator, Response } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { AgentPage } from '../../pages/AgentPage';
import { buttonNamed, waitForSave } from '../../pages/FormHelpers';

/*
 * AGENT BUSINESS RULES - the product owner's answers in reports/Agent-Questions/Agent-Questions.xlsx (17-Nov-2026).
 * Part A (read-only, every save BLOCKED) on AG-00002 "Gulf Horizons Travel LLC" and the Add form.
 * Part B (REAL saves) on a new "QA Auto Agent <STAMP> rules"; afterAll sets every QA Auto Agent to Blocked.
 */
const STAMP = process.env.RUN_STAMP!;
const AG = '/agents/2';

const vbtn = (page: Page, name: string): Locator => buttonNamed(page, name);
const nextWrite = (page: Page, what: RegExp, ms = 12_000) =>
  page.waitForRequest(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method()) && what.test(r.url()), { timeout: ms }).catch(() => null);
const openTab = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(2500);
};

// =====================================================================================================================
test.describe('Part A - agent screens (nothing is saved)', () => {
  let a: AgentPage;
  test.beforeEach(async ({ page }) => { await blockWrites(page); a = new AgentPage(page); });

  test('TC-AR-01: An agent that left "On Hold" cannot go back to "On Hold" (Approved agent offers Approved / Blocked only)', async ({ page }) => {
    test.fail(true, 'BUG: an Approved agent still offers "On Hold"');
    await openTab(page, `${AG}/overview`);
    await vbtn(page, 'Edit').click();
    await page.locator('main input[value="Approved"]').first().click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('option', { name: 'On Hold', exact: true }), '"On Hold" offered on an Approved agent').toHaveCount(0);
  });

  test('TC-AR-02: Client type is only B2B / B2C (no General / Concierge / Desk)', async ({ page }) => {
    test.fail(true, 'BUG (product owner): the Add form still offers General / Concierge / Desk');
    await a.openAdd();
    for (const t of ['General', 'Concierge', 'Desk']) await expect(page.getByRole('button', { name: t, exact: true }), `"${t}" is offered`).toHaveCount(0);
  });

  test('TC-AR-03: An agent address phone must be a standard phone number ("abc!!" refused)', async ({ page }) => {
    test.fail(true, 'BUG: an address phone "abc!!" is sent - the phone format is not checked');
    await openTab(page, `${AG}/addresses`);
    await vbtn(page, 'Edit').click();
    await page.locator('main input[placeholder="Phone"]:visible').first().fill('abc!!');
    const w = nextWrite(page, /addresses/);
    await vbtn(page, 'Save').click();
    expect(await w, 'an address with phone "abc!!" was sent').toBeNull();
  });

  test('TC-AR-04: The agent list can be filtered by Code', async ({ page }) => {
    test.fail(true, 'ENHANCEMENT (product owner): the Code column has no search / filter');
    await a.open();
    // stage 24 Nov 2026: column searches open when the column title is clicked (like Name)
    await page.getByRole('columnheader', { name: /^Code/ }).getByRole('button', { name: 'Code', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /^Code/ }).getByRole('textbox').or(page.locator('main thead input[placeholder="Search code"]')).first()).toBeVisible();
  });

  test('TC-AR-05: Account manager is required when creating an agent', async ({ page }) => {
    test.fail(true, 'BUG (product owner): the Add agent form has no (required) Account manager field - agents are created without one');
    await a.openAdd();
    const field = page.locator('main').getByText(/^Account manager/).first();
    await expect(field, 'no "Account manager" field on Add agent').toBeVisible({ timeout: 10_000 });
    await expect(field, 'Account manager is not marked required').toContainText('*');
  });

  test('TC-AR-06: Agent currency payment days above 365 are not accepted', async ({ page }) => {
    test.fail(true, 'BUG: an agent currency with 366 payment days is sent (0-365 like supplier)');
    await openTab(page, `${AG}/financials`);
    await vbtn(page, 'Add currency').click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Select currency').click();
    await page.getByRole('option').first().click();
    await d.getByRole('textbox', { name: 'Days' }).or(d.locator('input[aria-label="Days"]')).first().fill('366');
    const w = nextWrite(page, /currencies/);
    await d.getByRole('button', { name: 'Add' }).click();
    expect(await w, 'an agent currency with 366 payment days was sent').toBeNull();
  });
});

// =====================================================================================================================
test.describe('Part B - rules the server decides (REAL saves on a QA agent)', () => {
  test.describe.configure({ mode: 'serial' });
  const NAME = `QA Auto Agent ${STAMP} rules`;
  const EMAIL = `qa.auto.rules.${STAMP.toLowerCase()}@example.com`;
  let page: Page;
  let a: AgentPage;
  let url = '';

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    a = new AgentPage(page);
  });

  const saved = (click: () => Promise<unknown>, what = /agent/i) => waitForSave(page, click, what, { timeout: 20_000 });
  const dlg = () => page.getByRole('dialog').last();
  const create = async (name: string, email: string) => {
    await a.openAdd();
    await a.name.fill(name);
    await a.email.fill(email);
    await page.locator('main input[placeholder="Exchange type"], main input[placeholder="Search exchange types"]').first().click(); await page.getByRole('option').first().click();
    await a.country.click(); await page.keyboard.type('United Arab', { delay: 30 }); await page.waitForTimeout(1500); await page.getByRole('option', { name: 'United Arab Emirates' }).first().click();
    await page.locator('main input[placeholder="Select currency"], main input[placeholder="Select a currency"]').first().click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
    // stage 24 Nov 2026: Account manager is required (BUG-74 fixed) - pick the first user
    const am = page.locator('main input[placeholder="Search users"]').first();
    if (await am.isVisible().catch(() => false)) { await am.click(); await page.getByRole('option').first().click(); }
    return saved(() => a.createButton.click(), /\/agent\/agents$/);
  };

  test.afterAll(async () => {
    test.setTimeout(400_000);
    try {
      for (let i = 0; i < 10; i++) {
        await a.open();
        await a.search('QA Auto Agent');
        // stage 24 Nov 2026: Status moved to another column (Sales channel added) -> match "Blocked" anywhere in the row
        const open = a.rows.filter({ hasText: 'QA Auto Agent' }).filter({ hasNotText: 'Blocked' });
        if (await open.count() === 0) break;
        await open.first().locator('td').first().click();
        await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(2000);
        // stage 24 Nov 2026: "Edit Agent" opens the full form; Status is a button group Approved / On hold / Blocked
        await page.getByRole('button', { name: /^Edit agent$/i }).first().click();
        await page.locator('main').getByRole('button', { name: 'Blocked', exact: true }).first().click({ timeout: 60_000 });
        await saved(() => page.getByRole('button', { name: /^(Save|Save changes|Update agent)$/i }).first().click());
        console.log(`cleanup: ${page.url()} -> Blocked`);
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  test(`TC-AR-10: Create "${NAME}" (AED) and add USD`, async () => {
    const r = await create(NAME, EMAIL);
    expect(r?.ok(), `create failed ${r?.status()}`).toBe(true);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    url = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
    await openTab(page, `${url}/financials`);
    await vbtn(page, 'Add currency').click();
    await dlg().getByPlaceholder('Select currency').click();
    await page.getByRole('option', { name: /US Dollar/ }).click();
    await dlg().getByRole('textbox', { name: 'Days' }).or(dlg().locator('input[aria-label="Days"]')).first().fill('30');
    const r2 = await saved(() => dlg().getByRole('button', { name: 'Add' }).click());
    expect(r2?.ok(), 'add USD failed').toBe(true);
  });

  test('TC-AR-11: The default currency CAN be changed (USD becomes the default)', async () => {
    await openTab(page, `${url}/financials`);
    const usdRow = page.locator('main tbody tr:visible', { hasText: 'US Dollar' }).first();
    await usdRow.getByRole('button', { name: /Default currency|Make default|Set as default/ }).first().click();
    const d = dlg();
    if (await d.isVisible({ timeout: 2500 }).catch(() => false)) await d.getByRole('button', { name: /Change|Yes|Confirm|Make default|Save/ }).last().click();
    await page.waitForTimeout(2500);
    await openTab(page, `${url}/financials`);
    await expect(page.locator('main tbody tr:visible', { hasText: 'US Dollar' }).first().getByRole('button', { name: /Default currency/ }).first()).toBeDisabled({ timeout: 30_000 });
  });

  test('TC-AR-12: An agent currency can NOT be removed', async () => {
    test.fail(true, 'BUG (product owner): "Remove currency" removes an agent currency - currencies must never be removed');
    await openTab(page, `${url}/financials`);
    const notDefault = 'AED';                                // USD became the default in TC-AR-11
    await page.getByRole('button', { name: `More for ${notDefault}` }).first().click();
    const item = page.getByRole('menuitem', { name: 'Remove currency' });
    if (await item.count() === 0 || await item.isDisabled()) return;          // expected: not possible
    await item.click();
    if (await dlg().isVisible({ timeout: 2500 }).catch(() => false)) {
      const r = await saved(() => dlg().getByRole('button', { name: /Remove|Yes|Confirm/ }).last().click());
      expect(r === null || !r.ok(), `${notDefault} was removed from the agent`).toBe(true);
    } else {
      expect(false, 'the currency was removed without any check').toBe(true);
    }
  });

  test('TC-AR-13: A ledger deduction larger than the wallet balance IS allowed', async () => {
    await openTab(page, `${url}/financials`);
    await vbtn(page, 'More').click();
    await page.getByRole('menuitem', { name: 'Ledger adjustment' }).click();
    await dlg().getByText('Deduct funds (−)').click();
    await dlg().locator('input[type=number]').fill('50');
    await dlg().locator('textarea').first().fill('QA Auto deduct more than the wallet');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r?.ok(), `deducting more than the wallet was refused (${r?.status()})`).toBe(true);
  });

  test('TC-AR-14: A second agent with the SAME name (different email) IS allowed', async () => {
    test.fail(true, 'BUG (product owner): a second agent with the same name is refused (400) - duplicate names must be allowed');
    const r = await create(NAME, `qa.auto.rules2.${STAMP.toLowerCase()}@example.com`);
    expect(r?.ok(), `an agent with a duplicate name was refused (${r?.status()})`).toBe(true);
  });
});
