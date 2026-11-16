import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { AgentPage } from '../../pages/AgentPage';

/*
 * AGENT - every button and dialog that was not yet covered by agent-ui.spec.ts.
 * READ-ONLY: every save is blocked. Data: AG-00002 "Gulf Horizons Travel LLC" (/agents/2).
 */
const AG = '/agents/2';
let blocked: string[];
let a: AgentPage;
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); a = new AgentPage(page); });

/** a visible button by its exact text (the app keeps hidden copies of pages) */
const vbtn = (page: Page, name: string): Locator => page.locator('main button:visible', { hasText: new RegExp(`^${name.replace(/[()&+]/g, '\\$&')}$`) }).first();
const dlg = (page: Page) => page.getByRole('dialog').last();
const go = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole('tab', { name: 'Overview', exact: true }).or(page.getByRole('heading', { name: /Add agent|Agents|Credit/ })).first()).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(2500);
};

test.describe('Add agent - extra fields', () => {
  test('TC-AGF-01: Exchange type offers "Default Exchange"; Default currency offers INR / USD / AED / EUR', async ({ page }) => {
    await a.openAdd();
    await page.locator('main input[placeholder="Exchange type"]').click();
    await expect(page.getByRole('option', { name: 'Default Exchange' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('main input[placeholder="Select currency"]').click();
    await expect(page.getByRole('option')).toHaveText(['Indian Rupee', 'US Dollar', 'UAE Dirham', 'Euro']);
  });

  test('TC-AGF-02: Markets offers the company markets (Default Market, Asian Market)', async ({ page }) => {
    await a.openAdd();
    await page.getByPlaceholder('No markets').click();
    await expect(page.getByRole('option', { name: 'Default Market' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Asian Market' })).toBeVisible();
  });

  test('TC-AGF-03: Payment term offers 5 terms', async ({ page }) => {
    await a.openAdd();
    await page.locator('main input[value="Days After Invoice"]').click();
    await expect(page.getByRole('option')).toHaveText(['Days After Invoice', 'Days After Arrival', 'Days Before Invoice', 'Days Before Arrival', 'Nth Date Every Month']);
  });

  test('TC-AGF-04: Empty form shows the required messages for name, email and default currency', async ({ page }) => {
    await a.openAdd();
    await a.createButton.click();
    await expect(page.getByText('Agent Name is required').first()).toBeVisible();
    await expect(page.getByText('Email is required').first()).toBeVisible();
    await expect(page.getByText('Select a default currency').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-05: "Allow credit" shows a Credit limit; "Portal access" asks for a Login ID ("Login ID is required for portal access")', async ({ page }) => {
    await a.openAdd();
    await page.locator('main input[aria-label="Allow credit"]').click();
    await expect(page.locator('main input[aria-label="Credit limit"]')).toBeVisible();
    await page.locator('main input[aria-label="Portal access"]').click();
    await expect(page.locator('main input[type=password]:visible')).toBeVisible();
    await page.locator('main input[placeholder="Agent name"]').fill('QA Auto Agent portal check');
    await page.locator('main input[placeholder="agency@example.com"]').fill('qa.auto.portal@example.com');
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'US Dollar' }).click();
    await a.createButton.click();
    await expect(page.getByText('Login ID is required for portal access').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-06: A negative credit limit (-500) is not accepted', async ({ page }) => {
    test.fail(true, 'BUG: an agent with a negative credit limit (-500) is sent');
    await a.openAdd();
    await page.locator('main input[aria-label="Allow credit"]').click();
    await page.locator('main input[placeholder="Agent name"]').fill('QA Auto Agent credit check');
    await page.locator('main input[placeholder="agency@example.com"]').fill('qa.auto.credit@example.com');
    await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Country"]').first().click(); await page.keyboard.type('United Arab', { delay: 30 }); await page.getByRole('option').first().click();
    await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'US Dollar' }).click();
    const limit = page.locator('main input[aria-label="Credit limit"]');
    await limit.fill('-500');
    await a.createButton.click();
    await page.waitForTimeout(2500);
    expect(blocked, 'an agent with credit limit -500 was sent').toEqual([]);
  });
});

test.describe('Agent page - Overview and full edit', () => {
  test('TC-AGF-10: Inline Edit - empty name says "Agent name is required" and nothing is sent', async ({ page }) => {
    await go(page, `${AG}/overview`);
    await vbtn(page, 'Edit').click();
    await page.getByRole('textbox', { name: 'Agent name' }).last().fill('');
    await vbtn(page, 'Save').click();
    await expect(page.getByText('Agent name is required').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-11: Inline Edit - invalid email says "Enter a valid e-mail address"', async ({ page }) => {
    await go(page, `${AG}/overview`);
    await vbtn(page, 'Edit').click();
    await page.getByRole('textbox', { name: 'Email' }).last().fill('abc');
    await vbtn(page, 'Save').click();
    await expect(page.getByText('Enter a valid e-mail address').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-12: Inline Edit - status offers Approved / On Hold / Blocked; Cancel with changes asks to discard', async ({ page }) => {
    await go(page, `${AG}/overview`);
    await vbtn(page, 'Edit').click();
    await page.locator('main input[value="Approved"]').first().click();
    await expect(page.getByRole('option')).toHaveText(['Approved', 'On Hold', 'Blocked']);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Agent name' }).last().fill('Gulf Horizons Travel LLC x');
    await vbtn(page, 'Cancel').click();
    await expect(dlg(page)).toContainText('Discard unsaved changes?');
  });

  test('TC-AGF-13: "Edit agent" opens the full edit page; empty name is refused there too', async ({ page }) => {
    await go(page, `${AG}/overview`);
    await vbtn(page, 'Edit agent').click();
    await expect(page).toHaveURL(/\/agents\/2\/edit/);
    await expect(vbtn(page, 'Save changes')).toBeVisible();
    await page.locator('main input[placeholder="Agent name"]').last().fill('');
    await vbtn(page, 'Save changes').click();
    await expect(page.getByText('Agent Name is required').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-14: Addresses - Edit, invalid email is refused ("Enter a valid email address")', async ({ page }) => {
    await go(page, `${AG}/addresses`);
    await vbtn(page, 'Edit').click();
    await page.locator('main input[placeholder="Email"]:visible').first().fill('abc');
    await vbtn(page, 'Save').click();
    await expect(page.getByText('Enter a valid email address').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });
});

test.describe('Agent page - Financials', () => {
  test.beforeEach(async ({ page }) => { await go(page, `${AG}/financials`); });

  test('TC-AGF-20: Add currency - Currency is required; only currencies the agent does not have yet are offered', async ({ page }) => {
    await vbtn(page, 'Add currency').click();
    await dlg(page).getByRole('button', { name: 'Add' }).click();
    await expect(dlg(page)).toContainText('Please select a currency.');
    await dlg(page).getByPlaceholder('Select currency').click();
    const offered = await page.getByRole('option').allInnerTexts();
    expect(offered.some(o => /AED/.test(o)), 'AED (already on the agent) is offered again').toBe(false);
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-21: Account filter offers All accounts / Wallet / Credit / Promotional / Supplier credit', async ({ page }) => {
    await vbtn(page, 'Account').click();
    await expect(page.getByRole('menuitem')).toHaveText(['All accounts', 'Wallet', 'Credit', 'Promotional', 'Supplier credit']);
  });

  test('TC-AGF-22: "More" offers Record credit settlement / Ledger adjustment / Grant promotional credit / Record supplier credit', async ({ page }) => {
    await vbtn(page, 'More').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Record credit settlement', 'Ledger adjustment', 'Grant promotional credit', 'Record supplier credit']);
  });

  for (const item of ['Record credit settlement', 'Ledger adjustment', 'Grant promotional credit', 'Record supplier credit']) {
    test(`TC-AGF-23: "${item}" - empty Save says "Enter an amount greater than zero." and sends nothing`, async ({ page }) => {
      await vbtn(page, 'More').click();
      await page.getByRole('menuitem', { name: item }).click();
      await dlg(page).getByRole('button', { name: 'Save' }).click();
      await expect(dlg(page)).toContainText('Enter an amount greater than zero.');
      expect(blocked).toEqual([]);
    });
  }

  test('TC-AGF-24: Add top-up - empty Save is refused; negative amount is refused', async ({ page }) => {
    await vbtn(page, 'Add top-up').click();
    await expect(dlg(page)).toContainText('Add wallet top-up');
    await dlg(page).getByRole('button', { name: 'Save' }).click();
    await expect(dlg(page).locator('.Mui-error, [role=alert]').first()).toBeVisible();
    await dlg(page).locator('input[type=number]').fill('-100');
    await dlg(page).getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(2000);
    expect(blocked, 'a negative top-up was sent').toEqual([]);
  });

  test('TC-AGF-25: Loyalty "Adjust" - empty Save says "Enter a whole number of points."', async ({ page }) => {
    await vbtn(page, 'Adjust').click();
    await dlg(page).getByRole('button', { name: 'Save' }).click();
    await expect(dlg(page)).toContainText('Enter a whole number of points.');
    expect(blocked).toEqual([]);
  });

  test('TC-AGF-26: The default currency (AED) cannot be removed', async ({ page }) => {
    await page.getByRole('button', { name: 'More for AED' }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Remove currency' })).toBeDisabled();
  });

  test('TC-AGF-27: "All requests" opens the Credit Requests page', async ({ page }) => {
    await vbtn(page, 'All requests').click();
    await expect(page).toHaveURL(/\/agents\/credit-requests/, { timeout: 30_000 });
  });
});

test.describe('Agent page - Access and On-behalf', () => {
  test('TC-AGF-30: Access - Products lists every service with a switch; Edit makes them changeable', async ({ page }) => {
    await go(page, `${AG}/access`);
    for (const s of ['Hotel', 'Excursion', 'Private transfer', 'Packages']) await expect(page.locator(`main :text-is("${s}"):visible`).first(), s).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\d+ of \d+ on/).first()).toBeVisible();
    await vbtn(page, 'Edit').click();
    await expect(page.locator('main input[aria-label="Hotel"]:visible').first()).toBeEnabled();
  });

  test('TC-AGF-31: Access - portal access buttons: Portal login, Payments, Credit line, Company settings', async ({ page }) => {
    await go(page, `${AG}/access`);
    for (const b of ['Portal login', 'Payments', 'Credit line', 'Company settings']) await expect(vbtn(page, b), b).toBeVisible();
    await expect(vbtn(page, 'Login on behalf')).toBeVisible();
  });

  test('TC-AGF-32: On-behalf activity - "Done for this agent" / "Done by this agent" and an acting-agent filter', async ({ page }) => {
    await go(page, `${AG}/onbehalf`);
    await expect(vbtn(page, 'Done for this agent')).toBeVisible();
    await expect(vbtn(page, 'Done by this agent')).toBeVisible();
    await expect(page.getByPlaceholder('Any acting agent')).toBeVisible();
  });
});
