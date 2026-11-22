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

// ======================= EXCHANGE RATE =======================
test.describe('Business rules - Exchange Rates', () => {
  test('TC-BR-XR-01: Every rate has its REVERSE (same type and date, rate = 1 / rate)', async ({ page }) => {
    test.fail(true, 'BUG-127: EUR -> INR (100) and USD -> INR (88) of 01 Oct 2026 have no automatic reverse rate');
    await openPage(page, '/exchangerates', 'Exchange Rates');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    const list = [] as { type: string; from: string; to: string; rate: number; date: string }[];
    const next = page.getByRole('button', { name: 'Go to next page' });
    for (let pageNo = 1; pageNo <= 20; pageNo++) {                    // read EVERY page (10 rows per page)
      await page.waitForLoadState('networkidle');
      for (let i = 0; i < await rows.count(); i++) {
        const c = (await rows.nth(i).locator('td').allInnerTexts()).map(t => t.trim());
        const rate = Number(c[3].match(/= ([\d.,]+)/)?.[1].replace(/,/g, ''));
        list.push({ type: c[0], from: c[1], to: c[2], rate, date: c[4] });
      }
      if (!(await next.isEnabled())) break;
      const first = await rows.first().innerText();
      await next.click();
      await expect(rows.first()).not.toHaveText(first);
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
    test.fail(true, 'BUG-116: the deactivate popup gives no "already in use" warning (product owner rule, 13 Nov)');
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
