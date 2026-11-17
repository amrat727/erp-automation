import { test, expect } from '../../fixtures';
import { Page, Locator, Response } from '@playwright/test';
import { AgentPage } from '../../pages/AgentPage';

/*
 * AGENT ACCESS + remaining ledger actions - REAL saves on a new "QA Auto Agent <STAMP> access" (always Blocked at the end).
 * Portal login is only checked for its required Login ID: the tests never type a password.
 */
const STAMP = process.env.RUN_STAMP!;
const NAME = `QA Auto Agent ${STAMP} access`;
const EMAIL = `qa.auto.access.${STAMP.toLowerCase()}@example.com`;

test.describe.configure({ mode: 'default' });   // one failing setting must not skip the others (file runs in order, 1 worker)
test.describe('Agent: access settings and ledger', () => {
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

  const vbtn = (name: string, scope?: Locator): Locator => (scope ?? page.locator('main')).locator('button:visible', { hasText: new RegExp(`^${name.replace(/[()&+]/g, '\\$&')}$`) }).first();
  const dlg = () => page.locator('.MuiDialog-paper:visible').last();   // the dialog body (role=dialog only wraps the title here)
  const ensureUrl = async () => {
    if (url) return;
    await a.open(); await a.search(NAME);
    await a.rows.filter({ hasText: NAME }).first().locator('td').first().click();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    url = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
  };
  const tab = async (t: string) => {
    await ensureUrl(); await page.goto(`${url}/${t}`); await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 90_000 }); await page.waitForTimeout(2500); };
  /** the card of a section on the Access tab, e.g. section('Portal menus') */
  const section = (title: string) => page.locator('main :visible').getByText(title, { exact: true }).first().locator('xpath=ancestor::*[.//button[normalize-space()="Edit"]][1]');
  const saved = async (click: () => Promise<unknown>, what = /agent/i): Promise<Response | null> => {
    const res = page.waitForResponse(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.request().method()) && what.test(r.url()), { timeout: 30_000 }).catch(() => null);
    await click();
    const r = await res;
    if (r) console.log(`SAVE ${r.request().method()} ${r.url()} -> ${r.status()}`);
    return r;
  };

  test.afterAll(async () => {
    test.setTimeout(300_000);
    try {
      if (url) {
        await tab('overview');
        await vbtn('Edit').click();
        await page.locator('main input[value="Approved"], main input[value="On Hold"]').first().click();
        await page.getByRole('option', { name: 'Blocked', exact: true }).click();
        await saved(() => vbtn('Save').click());
        console.log(`cleanup: ${url} -> Blocked`);
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  test(`TC-AGA-01: Create "${NAME}"`, async () => {
    await a.openAdd();
    await a.name.fill(NAME);
    await a.email.fill(EMAIL);
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await a.country.click(); await page.keyboard.type('United Arab', { delay: 60 }); await page.waitForTimeout(1500);
    await page.getByRole('option', { name: 'United Arab Emirates' }).first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
    const r = await saved(() => a.createButton.click(), /\/agent\/agents$/);
    expect(r?.ok(), `create failed ${r?.status()}`).toBe(true);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 60_000 });
    url = page.url().replace(/\/(overview|edit).*/, '').replace(/\/$/, '');
  });

  test('TC-AGA-02: Portal menus - "None" then Save -> 0 of 16; "All" then Save -> 16 of 16', async () => {
    await tab('access');
    for (const [btn, expected] of [['None', /0 of 16 on/], ['All', /16 of 16 on|All 16 on/]] as const) {
      await vbtn('Edit', section('Portal menus')).click();
      await vbtn(btn).click();
      const r = await saved(() => vbtn('Save').click());
      expect(r?.ok(), `portal menus ${btn} failed`).toBe(true);
      await tab('access');
      await expect(page.locator('main').getByText(expected).first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test('TC-AGA-03: Portal login - Login ID is required (no password is typed)', async () => {
    await tab('access');
    await vbtn('Edit', section('Portal login')).click();
    await expect(dlg()).toContainText('Allow sign-in to the portal');
    await page.waitForTimeout(1000);
    console.log('portal login dialog: ' + (await dlg().innerText()).replace(/\s+/g, ' ').slice(0, 300));
    const allow = dlg().locator('input[type=checkbox]').first();
    if (!(await allow.isChecked())) await allow.click();
    await page.waitForTimeout(800);
    const loginId = dlg().getByRole('textbox').first();
    await expect(loginId).toBeEnabled({ timeout: 10_000 });
    await loginId.fill('');
    await dlg().getByRole('button', { name: 'Save' }).click();
    await expect(dlg().locator('.Mui-error, [role=alert]').first()).toBeVisible({ timeout: 10_000 });
    await dlg().getByRole('button', { name: 'Cancel' }).click();
  });

  test('TC-AGA-04: Payments - "Customise for this agent" is saved (no longer follows company settings)', async () => {
    await tab('access');
    await vbtn('Edit', section('Payments')).click();
    await dlg().getByText('Customise for this agent').click();
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r?.ok(), `payments save failed ${r?.status()}`).toBe(true);
    await tab('access');
    const pay = section('Payments');
    await expect(pay, 'Payments still says "Company settings"').not.toContainText('Company settings', { timeout: 30_000 });
  });

  test('TC-AGA-05: Login on behalf - the reason is required (Save stays disabled without it)', async () => {
    await tab('access');
    await vbtn('Edit', section('Login on behalf')).click();
    await expect(dlg()).toContainText('Why is this changing?');
    await expect(dlg().getByRole('button', { name: 'Save' })).toBeDisabled();
    await dlg().getByRole('button', { name: 'Cancel' }).click();
  });

  const grantOnBehalf = async () => {
    await tab('access');
    await vbtn('Edit', section('Login on behalf')).click();
    const who = dlg().locator('input[type=text]').first();
    await who.click(); await page.keyboard.type('Gulf', { delay: 50 }); await page.waitForTimeout(1500);
    await page.getByRole('option', { name: /Gulf Horizons/ }).first().click();
    await page.keyboard.press('Escape').catch(() => {});
    await dlg().locator('textarea').first().fill('QA Auto - on-behalf test');
    return saved(() => dlg().getByRole('button', { name: 'Save' }).click());
  };

  test('TC-AGA-06: Login on behalf is refused while the agent is On Hold ("isn\'t active and approved")', async () => {
    const r = await grantOnBehalf();
    const body = r ? await r.text().catch(() => '') : '';
    console.log('on hold -> ' + (r?.status() ?? 'none') + ' ' + body.slice(0, 200));
    expect(r === null || !r.ok(), 'login on behalf was granted on an On Hold agent').toBe(true);
    expect(body).toMatch(/isn't active and approved/);
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('TC-AGA-06b: After approving the agent, AG-00002 may sign in as it -> "1 of 5"', async () => {
    await tab('overview');
    await vbtn('Edit').click();
    await page.locator('main input[value="On Hold"], main input[value="Approved"]').first().click();
    await page.getByRole('option', { name: 'Approved', exact: true }).click();
    if (await vbtn('Save').isEnabled()) await saved(() => vbtn('Save').click());
    const r = await grantOnBehalf();
    const body = r ? await r.text().catch(() => '') : '';
    expect(r?.ok(), `login on behalf save failed ${r?.status()} ${body.slice(0, 200)}`).toBe(true);
    await tab('access');
    await expect(section('Login on behalf')).toContainText('1 of 5', { timeout: 30_000 });
  });

  test('TC-AGA-07: Cancel & change - agency users may cancel / modify without approval -> saved', async () => {
    await tab('access');
    await vbtn('Edit', section('Cancel & change')).click();
    await dlg().locator('input[type=checkbox]').first().click();
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r?.ok(), `cancel & change save failed ${r?.status()}`).toBe(true);
    await tab('access');
    await page.locator('main :visible').getByText('Cancel & change', { exact: true }).first().click().catch(() => {});
    await expect(page.locator('main').getByText(/Agency users\s*Without approval/).first()).toBeVisible({ timeout: 30_000 });
  });

  test('TC-AGA-10: Record credit settlement 10 AED -> saved', async () => {
    await tab('financials');
    await vbtn('More').click();
    await page.getByRole('menuitem', { name: 'Record credit settlement' }).click();
    await dlg().locator('input[type=number]').fill('10');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r?.ok(), `credit settlement failed ${r?.status()}`).toBe(true);
  });

  test('TC-AGA-11: Record supplier credit 15 AED -> Supplier credit 15.00 AED', async () => {
    await tab('financials');
    await vbtn('More').click();
    await page.getByRole('menuitem', { name: 'Record supplier credit' }).click();
    await dlg().locator('input[type=number]').fill('15');
    await dlg().locator('textarea').first().fill('QA Auto supplier credit');
    const r = await saved(() => dlg().getByRole('button', { name: 'Save' }).click());
    expect(r?.ok(), `supplier credit failed ${r?.status()}`).toBe(true);
    await tab('financials');
    await expect(page.locator('main tbody tr:visible', { hasText: 'UAE Dirham' }).first()).toContainText('15.00 AED', { timeout: 30_000 });
  });

  test('TC-AGA-99: Cleanup - the QA agent is set to Blocked', async () => {
    test.setTimeout(180_000);
    await tab('overview');
    await vbtn('Edit').click();
    await page.locator('main input[value="Approved"], main input[value="On Hold"], main input[value="Blocked"]').first().click();
    await page.getByRole('option', { name: 'Blocked', exact: true }).click();
    if (await vbtn('Save').isEnabled()) { const r = await saved(() => vbtn('Save').click()); expect(r?.ok(), 'block failed').toBe(true); }
    await tab('overview');
    await expect(page.locator('main').getByText('Blocked').first()).toBeVisible({ timeout: 30_000 });
    url = '';                                            // nothing left for afterAll
  });
});
