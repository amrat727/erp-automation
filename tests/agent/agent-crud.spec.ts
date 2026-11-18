import { test, expect } from '../../fixtures';
import { Page, Locator, Response } from '@playwright/test';
import { AgentPage } from '../../pages/AgentPage';
import { buttonNamed, waitForSave } from '../../pages/FormHelpers';

/*
 * AGENT - end-to-end data flow (REAL saves, approved by the product owner).
 * Creates "QA Auto Agent <STAMP>" and works ONLY on it (no portal login: the tests never type passwords on this site).
 * afterAll ALWAYS sets every "QA Auto Agent ..." that is not Blocked to Blocked.
 */
const STAMP = process.env.RUN_STAMP!;
const NAME = `QA Auto Agent ${STAMP}`;
const RENAMED = `${NAME} edited`;
const EMAIL = `qa.auto.agent.${STAMP.toLowerCase()}@example.com`;

test.describe.configure({ mode: 'serial' });
test.describe('Agent: end-to-end data flow', () => {
  let page: Page;
  let a: AgentPage;
  let agentUrl = '';
  let current = NAME;

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    a = new AgentPage(page);
  });

  const vbtn = (name: string): Locator => buttonNamed(page, name);
  const dlg = () => page.getByRole('dialog').last();
  const aedRow = () => page.locator('main tbody tr:visible', { hasText: 'UAE Dirham' }).first();
  const go = async (tab: string) => {
    await page.goto(`${agentUrl}/${tab}`);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(2500);
  };
  /** click, wait for the save request, return the reply */
  const saved = async (click: () => Promise<unknown>, what = /agent/i): Promise<Response> => (await waitForSave(page, click, what, { timeout: 60_000, required: true }))!;
  const setStatus = async (status: 'Approved' | 'On Hold' | 'Blocked') => {
    await go('overview');
    await vbtn('Edit').click();
    await page.locator('main input[value="Approved"], main input[value="On Hold"], main input[value="Blocked"]').first().click();
    await page.getByRole('option', { name: status, exact: true }).click();
    if (await vbtn('Save').isEnabled()) return saved(() => vbtn('Save').click());
    await vbtn('Cancel').click();
    return null;
  };

  // ALWAYS: every QA Auto Agent that is not Blocked -> Blocked
  test.afterAll(async () => {
    test.setTimeout(400_000);
    try {
      for (let i = 0; i < 10; i++) {
        await a.open();
        await a.search('QA Auto Agent');
        const open = a.rows.filter({ hasText: 'QA Auto Agent' }).filter({ hasNot: page.locator('td:nth-child(5)', { hasText: 'Blocked' }) });
        if (await open.count() === 0) break;
        await open.first().locator('td').first().click();
        await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
        agentUrl = page.url().replace(/\/overview.*/, '');
        await setStatus('Blocked');
        console.log(`cleanup: ${agentUrl} -> Blocked`);
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  test(`TC-AGC-01: Create "${NAME}" (UAE, AED, credit allowed 1000) -> saved and opened`, async () => {
    await a.openAdd();
    await a.name.fill(NAME);
    await a.email.fill(EMAIL);
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await a.country.click(); await page.keyboard.type('United Arab', { delay: 30 }); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
    await page.locator('main input[aria-label="Allow credit"]').click();
    await page.locator('main input[aria-label="Credit limit"]').fill('1000');
    const r = await saved(() => a.createButton.click(), /\/agent\/agents$/);
    expect(r.ok(), `create failed ${r.status()} ${await r.text().catch(() => '')}`).toBe(true);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    agentUrl = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
    expect(agentUrl, 'agent page not opened').toMatch(/\/agents\/\d+$/);
  });

  test('TC-AGC-02: The new agent is in the list with an AG- code, status "On Hold"; email search finds it', async () => {
    await a.open();
    await a.search(NAME);
    const row = a.rows.filter({ hasText: NAME });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td').first()).toHaveText(/^AG-\d{5}$/);
    await expect(row).toContainText('On Hold');
    await a.nameSearch.fill('');
    await a.emailSearch.fill(EMAIL);
    await expect(a.rows.filter({ hasText: NAME })).toHaveCount(1, { timeout: 30_000 });
  });

  test('TC-AGC-03: Overview shows the saved values (name, email, country, exchange type)', async () => {
    await go('overview');
    await expect(page.getByRole('textbox', { name: 'Agent name' }).last()).toHaveValue(NAME);
    await expect(page.getByRole('textbox', { name: 'Email' }).last()).toHaveValue(EMAIL);
    await expect(page.locator('main input[value="United Arab Emirates"]').first()).toBeVisible();
    await expect(page.locator('main input[value="Default Exchange"]').first()).toBeVisible();
  });

  test('TC-AGC-04: Inline Edit - rename -> saved; the list shows the new name', async () => {
    await go('overview');
    await vbtn('Edit').click();
    await page.getByRole('textbox', { name: 'Agent name' }).last().fill(RENAMED);
    const r = await saved(() => vbtn('Save').click());
    expect(r.ok(), `rename failed ${r.status()}`).toBe(true);
    current = RENAMED;
    await a.open();
    await a.search(RENAMED);
    await expect(a.rows.filter({ hasText: RENAMED })).toHaveCount(1);
  });

  test('TC-AGC-05: Addresses - primary address saved (street, phone, email)', async () => {
    await go('addresses');
    await vbtn('Edit').click();
    await page.locator('main input[placeholder="Street, building"]:visible').first().fill('QA Auto Street 1');
    await page.locator('main input[placeholder="Phone"]:visible').first().fill('+971 4 555 0100');
    await page.locator('main input[placeholder="Email"]:visible').first().fill(EMAIL);
    const r = await saved(() => vbtn('Save').click());
    expect(r.ok(), `address save failed ${r.status()}`).toBe(true);
    await go('addresses');
    await expect(page.locator('main input[placeholder="Street, building"]').first()).toHaveValue('QA Auto Street 1');
    await expect(page.locator('main input[placeholder="Phone"]').first()).toHaveValue(/^\+971\s?4\s?555\s?0100$/);   // stored without spaces
  });

  test('TC-AGC-06: Financials - add currency USD (30 days after invoice) -> USD row appears', async () => {
    await go('financials');
    await vbtn('Add currency').click();
    await dlg().getByPlaceholder('Select currency').click();
    await page.getByRole('option', { name: /US Dollar/ }).click();
    const days = dlg().getByRole('textbox', { name: 'Days' }).or(dlg().locator('input[aria-label="Days"]')).first();
    await days.fill('30');
    const r = await saved(() => dlg().getByRole('button', { name: 'Add' }).click());
    expect(r.ok(), `add currency failed ${r.status()}`).toBe(true);
    await go('financials');
    await expect(page.getByRole('button', { name: 'More for USD' }).first()).toBeAttached();
  });

  test('TC-AGC-07: Wallet top-up of 100 AED (bank transfer) -> wallet 100.00 AED', async () => {
    await go('financials');
    await vbtn('Add top-up').click();
    await dlg().locator('input[type=number]').fill('100');
    await dlg().getByPlaceholder('UTR / cheque no. / payment id').fill(`QA-${STAMP}-TOPUP`);
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r.ok(), `top-up failed ${r.status()}`).toBe(true);
    await go('financials');
    await expect(aedRow()).toContainText('100.00 AED', { timeout: 30_000 });   // wallet column
  });

  test('TC-AGC-08: Ledger adjustment - deduct 20 AED from the wallet -> shown in the ledger', async () => {
    await go('financials');
    await vbtn('More').click();
    await page.getByRole('menuitem', { name: 'Ledger adjustment' }).click();
    await dlg().getByText('Deduct funds (−)').click();
    await dlg().locator('input[type=number]').fill('20');
    await dlg().getByRole('textbox', { name: 'Reference' }).or(dlg().locator('input[aria-label="Reference"]')).first().fill(`QA-${STAMP}-ADJ`).catch(() => {});
    await dlg().locator('textarea').first().fill('QA Auto ledger adjustment');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r.ok(), `ledger adjustment failed ${r.status()}`).toBe(true);
    await go('financials');
    await expect(aedRow()).toContainText('80.00 AED', { timeout: 30_000 });
  });

  test('TC-AGC-09: Grant promotional credit 25 AED -> Promotional 25.00 AED', async () => {
    await go('financials');
    await vbtn('More').click();
    await page.getByRole('menuitem', { name: 'Grant promotional credit' }).click();
    await dlg().locator('input[type=number]').fill('25');
    await dlg().locator('textarea').first().fill('QA Auto promotional credit');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r.ok(), `promotional credit failed ${r.status()}`).toBe(true);
    await go('financials');
    await expect(aedRow()).toContainText('25.00 AED', { timeout: 30_000 });
  });

  test('TC-AGC-10: Loyalty - give 10 points -> saved', async () => {
    await go('financials');
    await vbtn('Adjust').click();
    await dlg().locator('input[type=number]').fill('10');
    await dlg().locator('textarea').first().fill('QA Auto give points');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r.ok(), `loyalty +10 failed ${r.status()}`).toBe(true);
  });

  test('TC-AGC-11: Loyalty - taking off more points than the agent has (999) is refused', async () => {
    await go('financials');
    await vbtn('Adjust').click();
    await dlg().getByText('Take points off (−)').click();
    await dlg().locator('input[type=number]').fill('999');
    await dlg().locator('textarea').first().fill('QA Auto take too many points');
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /loyalty/i.test(r.url()), { timeout: 15_000 }).catch(() => null);
    await dlg().getByRole('button', { name: 'Save' }).click();
    const r = await res;
    expect(r === null || !r.ok(), 'took off 999 points from an agent with 10 points').toBe(true);
    await page.keyboard.press('Escape');
  });

  test('TC-AGC-12: Remove currency USD -> the USD row is gone', async () => {
    await go('financials');
    await page.getByRole('button', { name: 'More for USD' }).first().click();
    await page.getByRole('menuitem', { name: 'Remove currency' }).click();
    const d = dlg();
    if (await d.isVisible({ timeout: 3000 }).catch(() => false)) await saved(() => d.getByRole('button', { name: /Remove|Yes|Confirm/ }).last().click());
    await go('financials');
    await expect(page.getByRole('button', { name: 'More for USD' })).toHaveCount(0, { timeout: 30_000 });
  });

  test('TC-AGC-13: Access - switch "Villa" off -> saved and still off after reload', async () => {
    await go('access');
    await vbtn('Edit').click();
    const villa = page.locator('main input[aria-label="Villa"]:visible').first();
    if (await villa.isChecked()) await villa.click();
    const r = await saved(() => vbtn('Save').click());
    expect(r.ok(), `access save failed ${r.status()}`).toBe(true);
    await go('access');
    await vbtn('Edit').click();                                   // the switches are shown only in Edit
    await expect(page.locator('main input[aria-label="Villa"]:visible').first()).not.toBeChecked();
    await vbtn('Cancel').click();
  });

  test('TC-AGC-14: Status On Hold -> Approved; the Approved filter finds the agent', async () => {
    const r = await setStatus('Approved');
    expect(r?.ok(), 'status change failed').toBe(true);
    await a.open();
    await a.search(RENAMED);
    await expect(a.rows.filter({ hasText: RENAMED })).toContainText('Approved');
  });

  test('TC-AGC-15: A second agent with the SAME email is refused', async () => {
    await a.openAdd();
    await a.name.fill(`QA Auto Agent ${STAMP} same email`);
    await a.email.fill(EMAIL);
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /\/agent\/agents$/.test(r.url()), { timeout: 15_000 }).catch(() => null);
    await a.createButton.click();
    const r = await res;
    expect(r === null || !r.ok(), 'a second agent with the same email was saved').toBe(true);
  });

  test('TC-AGC-16: Cleanup - status Blocked; the Blocked filter finds the agent', async () => {
    const r = await setStatus('Blocked');
    expect(r?.ok(), 'block failed').toBe(true);
    await a.open();
    await a.search(RENAMED);
    await expect(a.rows.filter({ hasText: RENAMED })).toContainText('Blocked');
  });
});
