import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled } from '../../pages/FormHelpers';

/*
 * SYSTEM (menu Core > System) - Configurations, Help Center, Data Retention, Users. READ-ONLY tests (agreed: users, settings and retention rules must never change).
 * EVERY save request is BLOCKED in the browser; a test fails if the app tries to send something it should not.
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

const todayAs = (opts: Intl.DateTimeFormatOptions) => new Date().toLocaleDateString('en-GB', opts);

// ======================= CONFIGURATIONS =======================
test.describe('Configurations', () => {
  test('TC-CFG-01: Opens from menu Core > System > Configurations with Date & Time section @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'System', 'Configurations']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/system\/configurations$/);
    await expect(page.getByText('Date & Time')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Date format')).toBeVisible();
  });

  test('TC-CFG-02: Preview sentence shows TODAY in the selected format', async ({ page }) => {
    await openPage(page, '/system/configurations', 'Configurations');
    const today = todayAs({ day: '2-digit', month: 'short', year: 'numeric' });        // "12 Nov 2026"
    await expect(page.locator('main input').first()).toHaveValue('DD MMM YYYY');
    await expect(page.getByText(`Today shows as ${today}`)).toBeVisible();
  });

  test('TC-CFG-03: Picking another format updates the preview; Discard puts it back (nothing saved)', async ({ page }) => {
    await openPage(page, '/system/configurations', 'Configurations');
    const box = page.locator('main input').first();
    const before = await page.getByText(/^Today shows as/).innerText();
    await box.click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const texts = await options.allInnerTexts();                   // v1.0.2: "DD MMMM YYYY\n19 November 2026"
    const i = texts.findIndex(o => o.split('\n')[0].trim() !== 'DD MMM YYYY');
    test.skip(i < 0, 'only one date format offered');
    await options.nth(i).click();
    await expect(page.getByText(/^Today shows as/)).not.toHaveText(before);
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(box).toHaveValue('DD MMM YYYY');
    await expect(page.getByText(/^Today shows as/)).toHaveText(before);
    expect(blocked, 'Discard must not send anything').toEqual([]);
  });

  test('TC-CFG-04: "Save changes" is disabled while nothing has changed', async ({ page }) => {
    await openPage(page, '/system/configurations', 'Configurations');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });
});

// ======================= HELP CENTER =======================
test.describe('Help Center', () => {
  test('TC-HELP-01: Shows tabs All / To review / Drafts, a search box and sections with article counts', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    for (const t of ['All', 'To review', 'Drafts']) await expect(page.getByRole('button', { name: t, exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Search help')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Accounts\s+\d+$/ })).toBeVisible();
  });

  test('TC-HELP-02: Each section count equals the number of articles listed under it (Accounts)', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    const section = page.getByRole('button', { name: /^Accounts\s+\d+$/ });
    const count = Number((await section.innerText()).match(/\d+/)![0]);
    const accountsArticles = ['How accounting works in Pilot', 'Setting up accounting', 'Agent invoices and credit notes',
      'Supplier invoices and debit notes', 'Receipts, refunds and supplier payments', 'Journals and journal vouchers',
      'Trial balance, profit and loss, balance sheet and ledgers', 'Agent and supplier balances, ageing and statements',
      'Month-end and year-end close', 'Bank reconciliation', 'Recurring journals'];
    for (const a of accountsArticles) await expect(page.getByRole('button', { name: a, exact: true })).toBeVisible();
    expect(count).toBe(accountsArticles.length);
  });

  test('TC-HELP-03: Opening an article shows its title, "Updated" date and text', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    await page.getByRole('button', { name: 'Bank reconciliation', exact: true }).click();
    await expect(page.getByText(/^Updated \d{2} \w{3} \d{4}$/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Bank reconciliation' }).first()).toBeVisible();
  });

  test('TC-HELP-04: Search finds articles by words in the title', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    await page.getByPlaceholder('Search help').fill('journal');
    await expect(page.getByText('Journals and journal vouchers').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Recurring journals').first()).toBeVisible();
  });

  test('TC-HELP-05: Search with no match tells the user nothing was found', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    await page.getByPlaceholder('Search help').fill('zzzqqq');
    await expect(page.getByText(/no (articles|results|matches)|nothing (found|matches)/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-HELP-06: "Add article" opens an editor and leaving it sends nothing', async ({ page }) => {
    await openPage(page, '/system/help', 'Help Center');
    await page.getByRole('button', { name: 'Add article' }).click();
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape');
    expect(blocked, 'opening "Add article" must not save anything').toEqual([]);
  });
});

// ======================= DATA RETENTION (no Edit is ever saved) =======================
test.describe('Data Retention', () => {
  test('TC-RET-01: Shows a rule for Reservations, Enquiries and Feedback with its status and Edit', async ({ page }) => {
    await openPage(page, '/system/data-retention', 'Data Retention');
    for (const area of ['Reservations', 'Enquiries', 'Feedback'])
      await expect(page.getByRole('switch', { name: `${area} retention` })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(3);
    await expect(page.getByText(/Not set up — nothing is removed\.|remove|delete|after/i).first()).toBeVisible();
  });

  test('TC-RET-02: Removal log has columns, search and an empty message', async ({ page }) => {
    await openPage(page, '/system/data-retention', 'Data Retention');
    for (const col of ['When', 'Record', 'Removed', 'By', 'Message'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.getByPlaceholder('Search ref, message, who')).toBeVisible();
    await expect(page.getByText('No personal data has been removed yet.').or(page.locator('tbody tr').first())).toBeVisible();
  });

  test('TC-RET-03: Edit opens the rule form; closing it sends nothing', async ({ page }) => {
    await openPage(page, '/system/data-retention', 'Data Retention');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    test.info().annotations.push({ type: 'form', description: (await dlg.innerText()).slice(0, 300) });
    await dlg.getByRole('button', { name: /Cancel|Close|×/ }).first().click();
    await expect(dlg).toBeHidden();
    expect(blocked, 'closing the retention form must not save').toEqual([]);
  });

  test('TC-RET-04: Retention switch does not silently save without asking', async ({ page }) => {
    // BUG-128 fixed 22 Nov 2026
    await openPage(page, '/system/data-retention', 'Data Retention');
    const sw = page.getByRole('switch', { name: 'Reservations retention' });
    const before = await sw.isChecked();
    await sw.click({ force: true });                     // all writes are blocked anyway
    await page.waitForTimeout(1500);
    const confirm = page.getByRole('dialog').or(page.locator('.swal2-popup')).first();
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: /Cancel|No|Close/ }).first().click();
    else expect(blocked, 'retention ON/OFF was saved WITHOUT a confirmation').toEqual([]);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Reservations retention' })).toBeChecked({ checked: before, timeout: 60_000 });
  });
});

// ======================= USERS (never saved) =======================
test.describe('Users', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('button', { name: 'Add User' }).click();
    const dlg = dialogTitled(page, 'Add User');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-USR-01: Opens from menu Core > System > User; list shows the admin user @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'System', 'User']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/users$/);
    for (const col of ['Username', 'Name', 'Email', 'Role', 'Designation', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('cell', { name: 'sahil', exact: true })).toBeVisible();
  });

  test('TC-USR-02: Add User form has all fields; required ones marked *', async ({ page }) => {
    const dlg = await openAdd(page);
    for (const t of ['Username', 'Password', 'Name', 'Email', 'Department', 'Reports To', 'Restriction Group'])
      await expect(dlg.getByText(new RegExp(`^${t}\\s*\\*$`)).first(), `${t}*`).toBeVisible();
    for (const t of ['Designation', 'City']) await expect(dlg.getByText(t, { exact: true }).first()).toBeVisible();
  });

  test('TC-USR-03: Empty Save shows a message for EVERY required field, nothing is sent', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.getByRole('button', { name: 'Save' }).click();
    for (const f of ['Username', 'Password', 'Name', 'Email', 'Department', 'Reports To', 'Restriction Group'])
      await expect(dlg.getByText(`${f} is required`, { exact: true }), f).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-USR-04: Password is hidden while typing', async ({ page }) => {
    const dlg = await openAdd(page);
    await expect(dlg.locator('input[type=password]')).toHaveCount(1);
  });

  test('TC-USR-05: Invalid email ("abc") is rejected before sending', async ({ page }) => {
    const dlg = await openAdd(page);
    const inputs = dlg.locator('input[type=text]');
    await inputs.nth(0).fill('qa_auto_user');           // Username
    await dlg.locator('input[type=password]').fill('Test@12345');
    await inputs.nth(1).fill('QA Auto User');           // Name
    await inputs.nth(2).fill('abc');                    // Email
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText(/valid email|email is invalid|invalid email/i)).toBeVisible();
    expect(blocked, 'a user with email "abc" was sent').toEqual([]);
  });

  test('TC-USR-06: Clicking the admin row opens the user record with the user data (read-only until Edit)', async ({ page }) => {
    await openPage(page, '/users', 'Users');
    await page.getByRole('cell', { name: 'sahil', exact: true }).click();
    // v1.0.2: a full-page user record (tabs Overview / Security / History, read-only until "Edit")
    await expect(page.getByRole('heading', { name: 'Sahil Chauhan' }).first()).toBeVisible({ timeout: 30_000 });
    for (const tab of ['Overview', 'Security', 'History']) await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Sahil Chauhan');
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-USR-07: The logged-in admin cannot deactivate THEMSELF', async ({ page }) => {
    await openPage(page, '/users', 'Users');
    const sw = page.getByRole('row').filter({ hasText: 'sahil' }).locator('input[type=checkbox]');
    // BUG-124 fixed 22 Nov 2026
    await expect(sw).toBeChecked();
    if (await sw.isDisabled()) return;                  // rule enforced by a locked switch
    await sw.click();
    const popup = page.locator('.swal2-popup');         // otherwise a warning must stop it
    await expect(popup).toBeVisible();
    const text = await popup.innerText();
    await popup.getByRole('button', { name: /Cancel|OK/ }).first().click();   // never confirm - cancel first, then judge
    expect(text).toMatch(/yourself|own account|cannot/i);
  });

  test('TC-USR-08: Search by username finds the user; no match hides it', async ({ page }) => {
    await openPage(page, '/users', 'Users');
    // stage 22 Nov 2026: each column has its own search box ("Search username", "Search name", ...)
    const search = page.locator('thead input[placeholder="Search username"]').first();
    if (!(await search.isVisible().catch(() => false)))   // the search box is hidden until the column title is clicked
      await page.locator('thead th:has(input[placeholder="Search username"])').first().click({ position: { x: 30, y: 15 }, force: true });
    await search.fill('SAH');
    await expect(page.getByRole('cell', { name: 'sahil', exact: true })).toBeVisible();
    await search.fill('zzzqqq');
    await expect(page.getByRole('cell', { name: 'sahil', exact: true })).toBeHidden({ timeout: 15_000 });
  });
});
