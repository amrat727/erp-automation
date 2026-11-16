import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled, inputAfter } from '../../pages/FormHelpers';

/*
 * CORE - BUSINESS RULES explained by the product owner (13-Nov-2026).
 * READ-ONLY: every save is blocked. Popups are always CANCELLED, never confirmed.
 *
 *  - Users: standard password rules; nobody may "report to" themself (it breaks the reporting chain).
 *  - Exchange Rate: INR->USD and USD->INR always exist together (the reverse is created
 *    automatically) and rates keep their decimals.
 *  - Currency / Status: master data - ANY of them can be deactivated (there is no locked "base" currency).
 *  - Deactivating something still in use must warn "already in use" before going ahead.
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

const ACTIVE_SWITCH = 'tbody tr input[type=checkbox]';

// ======================= USERS =======================
test.describe('Business rules - Users', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('button', { name: 'Add User' }).click();
    const dlg = dialogTitled(page, 'Add User');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  // Standard rule: 8+ characters with a capital, a small letter, a digit and a symbol
  for (const [weak, why] of [['abc', 'too short'], ['abcdefgh', 'letters only'], ['12345678', 'digits only'], ['Password1', 'no symbol']]) {
    test(`TC-BR-USR-01: Weak password "${weak}" (${why}) is rejected with a password message`, async ({ page }) => {
      const dlg = await openAdd(page);
      await dlg.locator('input[type=password]').fill(weak);
      await dlg.getByRole('button', { name: 'Save' }).click();
      await expect(dlg.getByText(/password (must|should)|at least \d+|uppercase|special character|too weak/i).first(),
        `weak password "${weak}" gives no password-rule message`).toBeVisible();
      expect(blocked).toEqual([]);
    });
  }

  test('TC-BR-USR-02: Strong password "Test@12345" shows no password-rule message', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.locator('input[type=password]').fill('Test@12345');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText(/password (must|should)|at least \d+|uppercase|special character|too weak/i)).toHaveCount(0);
    expect(blocked).toEqual([]);
  });

  test('TC-BR-USR-03: A user cannot be picked as their OWN "Reports To"', async ({ page }) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('cell', { name: 'sahil', exact: true }).click();
    const dlg = dialogTitled(page, /Edit User/);
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    const fullName = await dlg.locator('input[type=text]').nth(1).inputValue();     // "Name" of the user being edited
    await inputAfter(dlg, 'Reports To').click();
    await page.waitForTimeout(1500);
    await expect(page.getByRole('option', { name: fullName, exact: true }),
      `"${fullName}" is offered as their own manager`).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(blocked).toEqual([]);
  });
});

// ======================= EXCHANGE RATE =======================
test.describe('Business rules - Exchange Rates', () => {
  test('TC-BR-XR-01: Every rate has its REVERSE (same type and date, rate = 1 / rate)', async ({ page }) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const list = [] as { type: string; from: string; to: string; rate: number; date: string }[];
    for (let i = 0; i < await rows.count(); i++) {
      const c = (await rows.nth(i).locator('td').allInnerTexts()).map(t => t.trim());
      const rate = Number(c[3].match(/= ([\d.,]+)/)?.[1].replace(/,/g, ''));
      list.push({ type: c[0], from: c[1], to: c[2], rate, date: c[4] });
    }
    const missing = list.filter(r => !list.some(x => x.type === r.type && x.date === r.date && x.from === r.to && x.to === r.from
      && Math.abs(x.rate * r.rate - 1) < 0.01));
    expect(missing.map(r => `${r.type}: 1 ${r.from} = ${r.rate} ${r.to} on ${r.date}`), 'rates without a matching reverse rate').toEqual([]);
  });

  test('TC-BR-XR-02: Rate keeps its decimals (83.4567 is not rounded)', async ({ page }) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    await page.getByRole('button', { name: 'Add Exchange Rate' }).click();
    const dlg = dialogTitled(page, 'Add Exchange Rate');
    const rate = dlg.locator('input[type=number]');
    await rate.fill('83.4567');
    await rate.blur();
    await expect(rate).toHaveValue('83.4567');
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    expect(blocked).toEqual([]);
  });
});

// ======================= ANY MASTER CAN BE DEACTIVATED =======================
for (const [screen, path, heading] of [['Currency', '/currency', 'Currencies'], ['Status', '/status', 'Status']]) {
  test(`TC-BR-${screen.toUpperCase()}-01: Every ${screen} can be deactivated (no switch is locked)`, async ({ page }) => {
    await openPage(page, path, heading);
    const switches = page.locator(ACTIVE_SWITCH);
    await expect(switches.first()).toBeVisible();
    for (let i = 0; i < await switches.count(); i++)
      await expect(switches.nth(i), `row ${i + 1} switch is locked`).toBeEnabled();
  });
}

// ======================= "ALREADY IN USE" WARNING =======================
// [screen path, heading, record that is used elsewhere, where it is used]
const IN_USE: [string, string, string, string][] = [
  ['/resourcetypes', 'Resource Types', 'Driver', 'personnel Amrat Choudhary'],
  ['/organization/branches', 'Branches', 'Delhi Branch', 'users / chart of accounts'],
  ['/organization/departments', 'Departments', 'Reservations', 'users / chart of accounts'],
  ['/currency', 'Currencies', 'US Dollar', 'exchange rates'],
  ['/exchangetypes', 'Exchange Type', 'Default Exchange', 'exchange rates'],
];
for (const [path, heading, record, usedBy] of IN_USE) {
  test(`TC-BR-INUSE: Deactivating "${record}" warns it is already in use (${usedBy})`, async ({ page }) => {
    await openPage(page, path, new RegExp(heading));
    const row = page.locator('tbody tr').filter({ hasText: record }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator('input[type=checkbox]').click();
    const popup = page.locator('.swal2-popup');
    await expect(popup).toBeVisible();
    const text = await popup.innerText();
    await popup.getByRole('button', { name: 'Cancel' }).click();         // NEVER confirm
    await expect(row.locator('input[type=checkbox]')).toBeChecked();
    expect(text, `popup does not say "${record}" is in use:\n${text}`).toMatch(/in use|used (by|in)|linked|assigned/i);
  });
}
