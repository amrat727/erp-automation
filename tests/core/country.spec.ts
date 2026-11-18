import { test, expect } from '../../fixtures'; // <- already logged in as sahil
import { CountryPage } from '../../pages/CountryPage';

/*
 * CORE > REGION > COUNTRY
 * UI / UX checks, Add Country form, and the full Add -> Deactivate flow.
 */

let country: CountryPage;

test.beforeEach(async ({ page }) => {
  country = new CountryPage(page);
});

// =====================================================================
// UI - list page (read only, safe to run in parallel)
// =====================================================================
test.describe('Country list - UI', () => {
  test.beforeEach(async () => { await country.open(); });

  test('TC-CTRY-01: Open Country via menu Core > Region > Country @smoke', async ({ page }) => {
    await country.openViaMenu();
    await expect(page).toHaveURL(/\/countries$/);
    await expect(country.heading).toBeVisible();
    // the menu item is highlighted & the workspace tab says "Countries"
    await expect(page.getByRole('button', { name: 'Country', exact: true })).toHaveClass(/selected|active/i);
    await expect(page.getByText('Countries', { exact: true }).first()).toBeVisible();
  });

  test('TC-CTRY-02: All page elements are visible', async () => {
    await expect(country.heading).toBeVisible();
    await expect(country.addButton).toBeVisible();
    await expect(country.addButton).toBeEnabled();
    await expect(country.auditButton).toBeVisible();
    await expect(country.columnsButton).toBeVisible();
    await expect(country.nameSearch).toBeVisible();
    await expect(country.activeFilter).toBeVisible();
    await expect(country.activeFilter).toHaveText('All'); // default filter
    await expect(country.page.getByText('Rows per page:')).toBeVisible();
    await expect(country.rangeText).toBeVisible();
  });

  test('TC-CTRY-03: Every row shows a name, an Active switch and a Share button', async () => {
    const count = await country.rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = country.rows.nth(i);
      await expect(row.locator('td').first()).not.toBeEmpty();
      await expect(row.locator('input[type=checkbox]')).toHaveAttribute('aria-label', 'Active');
      await expect(row.getByRole('button')).toBeVisible();
    }
  });

  test('TC-CTRY-04: Search by full name shows only that country', async () => {
    await country.search('India');
    await expect(country.row('India')).toBeVisible();
    for (const n of await country.names()) expect(n).toContain('India');
  });

  test('TC-CTRY-05: Search is partial and case-insensitive ("ind")', async () => {
    await country.search('ind');
    await expect(country.row('India')).toBeVisible();
    for (const n of await country.names()) expect(n.toLowerCase()).toContain('ind');
  });

  test('TC-CTRY-06: Search with no match shows the empty message', async () => {
    await country.search('zzzqqq');
    await expect(country.emptyMessage).toBeVisible();
    await expect(country.rows).toHaveCount(0);
    await expect(country.page.getByText('0–0 of 0')).toBeVisible();
  });

  test('TC-CTRY-07: Clearing the search brings all countries back', async () => {
    const before = await country.rows.count();
    await country.search('India');
    await country.search('');
    await expect(country.rows).toHaveCount(before);
  });

  test('TC-CTRY-08: Active filter has 3 options (All / Active / not-active)', async ({ page }) => {
    await country.activeFilter.click();
    await expect(page.getByRole('option')).toHaveCount(3);
    await expect(page.getByRole('option').nth(0)).toHaveText('All');
    await expect(page.getByRole('option').nth(1)).toHaveText('Active');
    await page.keyboard.press('Escape');
  });

  test('TC-CTRY-30: Filter option wording is correct English ("Inactive")', async ({ page }) => {
    test.fail(true, 'BUG: filter option says "Deactive" (not a word) - should be "Inactive"');
    await country.activeFilter.click();
    await expect(page.getByRole('option').nth(2)).toHaveText('Inactive', { timeout: 5_000 });
  });

  test('TC-CTRY-09: Filter "Active" shows only active countries', async () => {
    await country.filterActive('Active');
    const n = await country.rows.count();
    for (let i = 0; i < n; i++) await expect(country.rows.nth(i).locator('input[type=checkbox]')).toBeChecked();
  });

  test('TC-CTRY-10: Filter "Deactive" shows only deactivated countries', async () => {
    await country.filterActive('Deactive');
    const n = await country.rows.count();
    for (let i = 0; i < n; i++) await expect(country.rows.nth(i).locator('input[type=checkbox]')).not.toBeChecked();
  });

  test('TC-CTRY-11: Share opens the share panel for that country', async ({ page }) => {
    await country.row('India').getByRole('button').click();
    const panel = page.locator('.MuiPopover-paper, [role=dialog]').filter({ hasText: 'Share' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('India')).toBeVisible();
    await expect(panel.getByPlaceholder('Search people…')).toBeVisible();
  });

  test('TC-CTRY-12: Audit history opens with All / Created / Updated / Deactivated tabs', async ({ page }) => {
    await country.auditButton.click();
    const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
    await expect(audit).toBeVisible();
    for (const tab of ['All', 'Created', 'Updated', 'Deactivated']) await expect(audit.getByText(tab, { exact: true }).first()).toBeVisible();
    await expect(audit.getByText(/\d+ changes?/)).toBeVisible();
  });

  test('TC-CTRY-13: Page refresh stays on Countries', async ({ page }) => {
    await page.reload();
    await expect(country.heading).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/countries$/);
  });
});

// =====================================================================
// Add Country form - UX & validation (nothing is saved)
// =====================================================================
test.describe('Add Country form', () => {
  test.beforeEach(async () => {
    await country.open();
    await country.openAddDialog();
  });

  test('TC-CTRY-14: Add dialog shows title, required Name field and buttons', async () => {
    await expect(country.dialog.getByText('Add Country')).toBeVisible();
    await expect(country.dialog.getByText('Name*')).toBeVisible();
    await expect(country.nameField).toHaveAttribute('required', '');
    await expect(country.nameField).toHaveValue('');
    await expect(country.saveButton).toBeVisible();
    await expect(country.cancelButton).toBeVisible();
    await expect(country.closeButton).toBeVisible();
  });

  test('TC-CTRY-15: Save with empty Name shows "Name is required" and saves nothing', async ({ page }) => {
    let posted = false;
    page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/region/countries')) posted = true; });
    await country.saveButton.click();
    await expect(country.nameRequired).toBeVisible();
    await expect(country.dialog).toBeVisible();
    expect(posted).toBe(false);
  });

  test('TC-CTRY-16: Cancel closes the dialog without saving', async () => {
    await country.cancelButton.click();
    await expect(country.dialog).toBeHidden();
  });

  test('TC-CTRY-17: × (close) closes the dialog without saving', async () => {
    await country.closeButton.click();
    await expect(country.dialog).toBeHidden();
  });

  test('TC-CTRY-18: Name dropdown lists countries and filters while typing', async ({ page }) => {
    await country.nameField.click();
    expect(await page.getByRole('option').count()).toBeGreaterThan(200);
    await country.nameField.fill('Ind');
    await expect(page.getByRole('option')).toHaveText(['British Indian Ocean Territory', 'India', 'Indonesia']);
  });

  test('TC-CTRY-19: Typing a name that is not a country gives no options', async ({ page }) => {
    await country.nameField.click();
    await country.nameField.fill('Zzzqqq');
    await expect(page.getByRole('option')).toHaveCount(0);
  });

  test('TC-CTRY-20: Adding an existing country (India) is blocked with an error', async () => {
    const before = await country.rows.count();
    await country.chooseCountry('India');
    const [res] = await Promise.all([
      country.page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/region/countries')),
      country.saveButton.click(),
    ]);
    expect(res.status()).toBe(400);
    await expect(country.dialog.getByText('A record with the same unique value already exists.')).toBeVisible();
    await expect(country.dialog).toBeVisible(); // dialog stays open
    await country.cancelButton.click();
    await expect(country.rows).toHaveCount(before); // no duplicate row
  });
});

// =====================================================================
// END-TO-END: add a NEW country, then deactivate it.
// "serial" = these tests run in order and share the same country.
// =====================================================================
test.describe.serial('Add & deactivate a country (E2E)', () => {
  let newCountry: string;
  let popupMessage = '';

  test('TC-CTRY-21: Add a new country -> success message and it appears as Active', async ({ page }) => {
    await country.open();
    newCountry = await country.pickUnusedCountry();
    test.info().annotations.push({ type: 'test data', description: `Country added: ${newCountry}` });

    await country.openAddDialog();
    await country.chooseCountry(newCountry);
    await expect(country.nameField).toHaveValue(newCountry);
    const [res] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/region/countries')),
      country.saveButton.click(),
    ]);
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toBe(newCountry);
    expect(body.isActive).toBe(true);

    await expect(page.getByText('Country created successfully').first()).toBeVisible();
    await expect(country.dialog).toBeHidden();

    await country.search(newCountry);
    await expect(country.row(newCountry)).toBeVisible();
    await expect(country.toggle(newCountry)).toBeChecked(); // active by default
  });

  test('TC-CTRY-22: New country is shown in Audit history as created by sahil', async ({ page }) => {
    await country.open();
    await country.auditButton.click();
    const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
    // newest entry: "Sahil Chauhan created <country>" with Code + Name details
    await expect(audit.getByText(`Sahil Chauhan created ${newCountry}`, { exact: false }).first()).toBeVisible();
    await expect(audit.getByText('Today').first()).toBeVisible();
  });

  test('TC-CTRY-23: Deactivate popup shows warning icon, title, message and buttons', async () => {
    await country.open();
    await country.search(newCountry);
    await country.clickToggle(newCountry);

    await expect(country.popup).toBeVisible();
    await expect(country.popup).toHaveClass(/swal2-icon-warning/);          // warning (!) icon
    await expect(country.popupTitle).toHaveText('Deactivate country?');
    await expect(country.popupText).toContainText('This will mark the country as'); // exact grammar: TC-CTRY-29
    await expect(country.popupConfirm).toBeVisible();
    await expect(country.popupCancel).toBeVisible();
    popupMessage = (await country.popupText.innerText()).trim();          // saved for TC-CTRY-29
  });

  test('TC-CTRY-29: Deactivate popup message has correct grammar', async () => {
    test.fail(true, 'BUG: popup says "mark the country as deactive." - should be "inactive"');
    expect(popupMessage, 'popup text captured in TC-CTRY-23').not.toBe('');
    expect(popupMessage).toBe('This will mark the country as inactive.');
  });

  test('TC-CTRY-24: Cancel on the popup keeps the country Active', async ({ page }) => {
    let changed = false;
    page.on('request', r => { if (['DELETE', 'PUT'].includes(r.method()) && r.url().includes('/region/countries')) changed = true; });
    await country.open();
    await country.search(newCountry);
    await country.clickToggle(newCountry);
    await country.popupCancel.click();

    await expect(country.popup).toBeHidden();
    await expect(country.toggle(newCountry)).toBeChecked();
    expect(changed, 'no change must be sent to the server').toBe(false);
  });

  test('TC-CTRY-25: Confirm deactivate -> "Country deactivated" and switch turns off', async ({ page }) => {
    await country.open();
    await country.search(newCountry);
    await country.clickToggle(newCountry);
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/region/countries/') && ['DELETE', 'PUT'].includes(r.request().method())),
      country.popupConfirm.click(),
    ]);
    expect(res.ok()).toBe(true);
    await expect(page.getByText('Country deactivated').first()).toBeVisible();
    await expect(country.toggle(newCountry)).not.toBeChecked();
  });

  test('TC-CTRY-26: Deactivated status is saved (still off after reload)', async ({ page }) => {
    await country.open();
    await country.search(newCountry);
    await expect(country.toggle(newCountry)).not.toBeChecked();
  });

  test('TC-CTRY-27: Deactivated country appears under "Deactive" filter, not under "Active"', async () => {
    await country.open();
    await country.filterActive('Deactive');
    await country.search(newCountry);
    await expect(country.row(newCountry)).toBeVisible();

    await country.filterActive('Active');
    await expect(country.row(newCountry)).toHaveCount(0);
  });

  test('TC-CTRY-28: Deactivation is recorded in Audit history', async ({ page }) => {
    await country.open();
    await country.auditButton.click();
    const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
    await audit.getByText('Deactivated', { exact: true }).first().click();
    await expect(audit.getByText(`Sahil Chauhan deactivated ${newCountry}`).first()).toBeVisible();
  });
});
