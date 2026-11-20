import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { MasterListPage, blockWrites } from '../../pages/MasterListPage';
import { LoginPage } from '../../pages/LoginPage';
import { bugShot, openPage, dialogTitled } from '../../pages/FormHelpers';

/*
 * BUG EVIDENCE - takes ONE screenshot per bug, with the problem outlined in RED.
 * Pictures are saved to  screenshots/bugs/  and attached to the HTML report.
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test bug-evidence
 * SAFETY: all save/update/delete requests are blocked (except the one login attempt in BUG-01).
 */

const shot = bugShot;   // shared helper: pages/FormHelpers.ts

/** open a list, click the ACTIVE switch of `name` and return the page with its popup open (always Cancel it) */
const popupOf = async (page: Page, entity: string, plural: string, path: string, name: string) => {
  const p = new MasterListPage(page, entity, plural);
  await p.open(path);
  await p.search(name);
  await expect(p.toggle(name)).toBeChecked();         // only ever click an ACTIVE switch, then Cancel
  await p.clickToggle(name);
  await expect(p.popup).toBeVisible();
  return p;
};

test.describe('Bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');

  test('BUG-01 Login: spaces around company code / username are not trimmed', async ({ browser }) => {
    const page = await browser.newPage();           // clean tab = logged out
    const login = new LoginPage(page);
    await login.open();
    const res = await login.login(`  ${process.env.ERP_COMPANY_CODE}  `, `  ${process.env.ERP_USERNAME}  `, process.env.ERP_PASSWORD!);
    expect(res.status()).toBe(401);
    await expect(login.errorInvalid).toBeVisible();
    await shot(page, 'BUG-01-login-spaces-not-trimmed', login.errorInvalid, login.username);
    await page.close();
  });

  test('BUG-02 Login: logged-in user opening /login sees the login form', async ({ page }) => {
    await page.goto('/dashboard');
    await page.goto('/login');
    const form = page.getByRole('button', { name: 'Sign in' });
    await expect(form).toBeVisible();
    await shot(page, 'BUG-02-login-page-while-logged-in', form);
  });

  test.describe('Region (writes blocked)', () => {
    test.beforeEach(async ({ page }) => { await blockWrites(page); });

    const popupFor = async (page: Page, entity: string, plural: string, path: string, name: string) => {
      const p = new MasterListPage(page, entity, plural);
      await p.open(path);
      await p.search(name);
      await expect(p.toggle(name)).toBeChecked();      // only ever click an ACTIVE switch
      await p.clickToggle(name);
      await expect(p.popup).toBeVisible();
      return p;
    };

    test('BUG-03 Country popup: "deactive" is not a word', async ({ page }) => {
      const p = await popupFor(page, 'Country', 'Countries', '/countries', 'India');
      await shot(page, 'BUG-03-country-popup-deactive-grammar', p.popupText);
      await p.popupCancel.click();
    });

    test('BUG-04 Active filter option "Deactive" (grammar)', async ({ page }) => {
      const p = new MasterListPage(page, 'Country', 'Countries');
      await p.open('/countries');
      await p.openActiveFilter();
      await shot(page, 'BUG-04-filter-deactive-grammar', page.getByRole('option', { name: 'Deactive' }));
    });

    test('BUG-05 Province filter says "Inactive" (others say "Deactive")', async ({ page }) => {
      const p = new MasterListPage(page, 'Province', 'Provinces');
      await p.open('/provinces');
      await p.openActiveFilter();
      await shot(page, 'BUG-05-province-filter-inactive', page.getByRole('option', { name: 'Inactive' }));
    });

    test('BUG-06 Province popup title "Deactivate Province?" (capital P)', async ({ page }) => {
      const p = new MasterListPage(page, 'Province', 'Provinces');
      await p.open('/provinces');
      let target = '';
      for (const n of await p.names()) if (await p.toggle(n).isChecked()) { target = n; break; }
      test.skip(!target, 'no ACTIVE province to open the popup on');
      const q = await popupFor(page, 'Province', 'Provinces', '/provinces', target);
      await shot(page, 'BUG-06-province-popup-title-capital', q.popupTitle);
      await q.popupCancel.click();
    });

    test('BUG-07 Landmark popup: "mark it as deactive" (different sentence)', async ({ page }) => {
      const p = await popupFor(page, 'Landmark', 'Landmarks', '/landmarks', 'DXB Terminal 1');
      await shot(page, 'BUG-07-landmark-popup-text', p.popupText);
      await p.popupCancel.click();
    });

    test('BUG-08 Airport popup: title uses CODE and text is different', async ({ page }) => {
      const p = await popupFor(page, 'Airport', 'Airports', '/airports', 'Aalborg Airport');
      await shot(page, 'BUG-08-airport-popup-different', p.popupTitle, p.popupText);
      await p.popupCancel.click();
    });

    test('BUG-09 State Name field silently removes digits', async ({ page }) => {
      const p = new MasterListPage(page, 'State', 'States');
      await p.open('/states');
      await p.addButton.click();
      const dlg = p.dialog('Add State');
      const name = p.field(dlg, 'Name');
      await name.pressSequentially('Zone 2 North-1');
      await expect(name).not.toHaveValue('Zone 2 North-1');
      await shot(page, 'BUG-09-name-digits-removed-typed-Zone-2-North-1', name);
    });

    test('BUG-10 Market: Countries is required but has no *', async ({ page }) => {
      const p = new MasterListPage(page, 'Market', 'Markets');
      await p.open('/markets');
      await p.addButton.click();
      const dlg = p.dialog('Add Market');
      await p.field(dlg, 'Name').fill('QA Auto Evidence');
      await dlg.getByRole('button', { name: 'Save' }).click();   // blocked anyway
      await page.waitForTimeout(1500);
      await shot(page, 'BUG-10-market-countries-required-no-asterisk', dlg.getByText(/^Countries/).first());
    });

    test('BUG-11 State: missing Country shown only as a banner - field not marked red like Name', async ({ page }) => {
      const p = new MasterListPage(page, 'State', 'States');
      await p.open('/states');
      await p.addButton.click();
      const dlg = p.dialog('Add State');
      await p.field(dlg, 'Name').fill('QA Auto Evidence');
      await dlg.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(1500);
      await shot(page, 'BUG-11-country-error-banner-field-not-red', dlg.getByText(/^Country/).first());
    });

    test('BUG-12 Desk Location: no Audit history, no Active filter', async ({ page }) => {
      const p = new MasterListPage(page, 'Desk Location', 'Desk Locations');
      await p.open('/desk-locations');
      await shot(page, 'BUG-12-desk-location-missing-audit-and-filter', p.columnsButton, page.locator('thead'));
    });

    test('BUG-13 Airport: no "Add Airport" button', async ({ page }) => {
      const p = new MasterListPage(page, 'Airport', 'Airports');
      await p.open('/airports');
      await shot(page, 'BUG-13-airport-no-add-button', p.columnsButton.locator('xpath=..'));
    });

    test('BUG-14 Add Country dropdown still lists already-added countries', async ({ page }) => {
      const p = new MasterListPage(page, 'Country', 'Countries');
      await p.open('/countries');
      await p.addButton.click();
      const dlg = p.dialog('Add Country');
      await dlg.getByRole('combobox').fill('India');
      const opt = page.getByRole('option', { name: 'India', exact: true });
      await expect(opt).toBeVisible();
      await shot(page, 'BUG-14-add-country-lists-existing-India', opt);
    });

    test('BUG-15 Airport data: "[Duplicate] Giebelstadt Army Air Field"', async ({ page }) => {
      const p = new MasterListPage(page, 'Airport', 'Airports');
      await p.open('/airports');
      await p.nameSearch.fill('Giebelstadt');
      const cell = page.getByText(/\[Duplicate\]/).first();
      await expect(cell).toBeVisible();
      await shot(page, 'BUG-15-airport-duplicate-data', cell);
    });

    test('BUG-16 Audit history: "sahil" on old entries, "Sahil Chauhan" on new', async ({ page }) => {
      const p = new MasterListPage(page, 'State', 'States');   // State still has old "sahil" entries
      await p.open('/states');
      await p.auditButton.click();
      const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
      await expect(audit.getByText(/Sahil Chauhan/).first()).toBeVisible();
      const old = audit.getByText('sahil', { exact: true }).first();   // old entries show the login id
      await old.scrollIntoViewIfNeeded();
      await shot(page, 'BUG-16-audit-mixed-user-names', old, audit.getByText('Sahil Chauhan', { exact: true }).last());
    });

    test('BUG-17 Country: clicking a row does not open Edit', async ({ page }) => {
      const p = new MasterListPage(page, 'Country', 'Countries');
      await p.open('/countries');
      await p.search('India');
      await p.row('India').locator('td').first().click();
      await page.waitForTimeout(2000);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await shot(page, 'BUG-17-country-no-edit-after-row-click', p.row('India'));
    });
  });
});

// ======================= CORE > PRODUCT =======================
test.describe('Bug evidence - Product (writes blocked)', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  const popupFor = async (page: Page, entity: string, plural: string, path: string, name: string, nameCol?: number) => {
    const p = new MasterListPage(page, entity, plural, { nameCol, subModule: 'Product' });
    await p.open(path);
    await p.search(name);
    await expect(p.toggle(name)).toBeChecked();      // only ever click an ACTIVE switch
    await p.clickToggle(name);
    await expect(p.popup).toBeVisible();
    return p;
  };

  test('BUG-18 Product Type / Supplement popup: "This will mark it as deactive."', async ({ page }) => {
    const p = await popupFor(page, 'Product Type', 'Product Types', '/producttype', 'Hotel', 2);
    await shot(page, 'BUG-18-product-type-popup-mark-it-deactive', p.popupText);
    await p.popupCancel.click();
  });

  test('BUG-19 View Type / Room Category / Amenity popup: different sentence', async ({ page }) => {
    const p = await popupFor(page, 'View Type', 'View Types', '/viewtypes', 'Park Facing');
    await shot(page, 'BUG-19-view-type-popup-different-sentence', p.popupText);
    await p.popupCancel.click();
  });

  test('BUG-20 Room Type popup: yet another sentence', async ({ page }) => {
    const p = await popupFor(page, 'Room Type', 'Room Types', '/roomtypes', 'Bunk');
    await shot(page, 'BUG-20-room-type-popup-different-sentence', p.popupText);
    await p.popupCancel.click();
  });

  test('BUG-21 Product menu: some items plural, others singular', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Core', exact: true }).click();
    await page.getByRole('button', { name: 'Product', exact: true }).click();
    const plural = ['Supplements', 'Allotments', 'Addons', 'Amenities'].map(n => page.getByRole('button', { name: n, exact: true }));
    await expect(plural[0]).toBeVisible();
    await shot(page, 'BUG-21-product-menu-plural-vs-singular', ...plural);
  });

  test('BUG-22 Product Type Name field silently removes digits', async ({ page }) => {
    const p = new MasterListPage(page, 'Product Type', 'Product Types', { nameCol: 2 });
    await p.open('/producttype');
    await p.addButton.click();
    const name = p.field(p.dialog('Add Product Type'), 'Name');
    await name.pressSequentially('Zone 2 North-1');
    await expect(name).not.toHaveValue('Zone 2 North-1');
    await shot(page, 'BUG-22-product-type-digits-removed-typed-Zone-2-North-1', name);
  });

  test('BUG-23 Product Type: required "Product" shows no error message', async ({ page }) => {
    const p = new MasterListPage(page, 'Product Type', 'Product Types', { nameCol: 2 });
    await p.open('/producttype');
    await p.addButton.click();
    const dlg = p.dialog('Add Product Type');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText('Name is required')).toBeVisible();
    await shot(page, 'BUG-23-product-type-product-required-no-message', dlg.getByText(/^Product\s*\*?$/).first().locator('xpath=..'));
  });

  test('BUG-24 Supplement: Product Type gets no error while Sequence does', async ({ page }) => {
    const p = new MasterListPage(page, 'Supplement', 'Supplements');
    await p.open('/supplements');
    await p.addButton.click();
    const dlg = p.dialog('Add Supplement');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText('Sequence is required')).toBeVisible();
    await shot(page, 'BUG-24-supplement-product-type-no-message', dlg.getByText(/^Product Type\s*\*?$/).first().locator('xpath=..'), dlg.getByText('Sequence is required'));
  });

  test('BUG-25 Duplicate name with spaces around it is saved (2 identical rows)', async ({ page }) => {
    const p = new MasterListPage(page, 'Product Type', 'Product Types', { nameCol: 2 });
    await p.open('/producttype');
    await p.search('QA Auto Product Type QMTVQV edited');
    const rows = p.row('QA Auto Product Type QMTVQV edited');
    await expect(rows).toHaveCount(2);
    await shot(page, 'BUG-25-duplicate-name-with-spaces-saved', rows.nth(0), rows.nth(1));
  });

  test('BUG-26 Name saved with spaces around it, and & ( ) silently removed', async ({ page }) => {
    const p = new MasterListPage(page, 'Product Type', 'Product Types', { nameCol: 2 });
    await p.open('/producttype');
    await p.search('Edge');
    // typed "QA Auto Product Type <TAG> Edge & Co (Test)" -> open Edit to show the full saved name
    await p.rows.first().locator('td:nth-child(2)').click();
    const name = p.field(p.dialog('Edit Product Type'), 'Name');
    await expect(name).toHaveValue(/^\s+QA Auto.*Edge\s+Co\s+Test\s+$/);   // spaces kept + & ( ) removed
    await shot(page, 'BUG-26-special-characters-removed-typed-Edge-and-Co-(Test)', name);
  });

  test('BUG-27 Search with spaces around the text finds nothing', async ({ page }) => {
    const p = new MasterListPage(page, 'Amenity', 'Amenities', { subModule: 'Product' });
    await p.open('/amenities');
    await p.nameSearch.fill('  Air Conditioning  ');
    await expect(p.emptyMessage).toBeVisible({ timeout: 15_000 });
    await shot(page, 'BUG-27-search-with-spaces-finds-nothing', p.nameSearch, p.emptyMessage);
  });
});

// ======================= NEW BUGS 13-Nov-2026 (Core: Application, Resource, Organization, Accounts, System) =======================
test.describe('Bug evidence - Core part 2 (writes blocked)', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });


  test('BUG-30 Department popup says "mark the BRANCH as deactive"', async ({ page }) => {
    const p = await popupOf(page, 'Department', 'Departments', '/organization/departments', 'Reservations');
    await expect(p.popupText).toContainText('branch');
    await shot(page, 'BUG-30-department-popup-says-branch', p.popupText);
    await p.popupCancel.click();
  });

  for (const [file, entity, plural, path] of [
    ['BUG-31-language-empty-form-sent-to-server', 'Language', 'Language', '/languages'],
    ['BUG-31-account-group-empty-form-sent-to-server', 'Account Group', 'Account Group', '/accountgroup'],
  ]) {
    test(`BUG-31 ${entity}: empty form is sent to the server (no "Name is required")`, async ({ page }) => {
      const p = new MasterListPage(page, entity, plural);
      await p.open(path);
      await p.addButton.click();
      const dlg = p.dialog(`Add ${entity}`);
      await dlg.getByRole('button', { name: 'Save' }).click();
      await expect.poll(() => blocked.length, { timeout: 10_000 }).toBeGreaterThan(0);   // the empty form left the browser
      await shot(page, file, dlg);
    });
  }

  test('BUG-32 Tax: empty Name says "Enter a name." (others: "Name is required")', async ({ page }) => {
    const p = new MasterListPage(page, 'Tax', 'Tax');
    await p.open('/tax');
    await p.addButton.click();
    await p.dialog('Add Tax').getByRole('button', { name: 'Save' }).click();
    const msg = page.getByText('Enter a name.').first();
    await expect(msg).toBeVisible();
    await shot(page, 'BUG-32-tax-name-message-different', msg);
  });

  test('BUG-33 Tax: Name stops before 150 characters (other screens allow 150)', async ({ page }) => {
    const p = new MasterListPage(page, 'Tax', 'Tax');
    await p.open('/tax');
    await p.addButton.click();
    const name = p.field(p.dialog('Add Tax'), 'Name');
    await name.fill('A'.repeat(150));
    const len = (await name.inputValue()).length;
    expect(len).toBeLessThan(150);
    await shot(page, `BUG-33-tax-name-limit-${len}-not-150`, name);
  });

  test('BUG-34 Add User: Restriction Group is required but there is none to pick', async ({ page }) => {
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add User' }).click({ timeout: 60_000 });
    const dlg = page.getByRole('dialog').filter({ hasText: 'Add User' }).last();
    await dlg.getByRole('button', { name: 'Save' }).click();
    const err = dlg.getByText('Restriction Group is required');
    await expect(err).toBeVisible();
    await dlg.getByText(/^Restriction Group\s*\*$/).locator('xpath=following::input[1]').click();
    await page.waitForTimeout(2500);
    await shot(page, 'BUG-34-add-user-restriction-group-required-but-empty', err);
    expect(blocked).toEqual([]);
  });

  test('BUG-35 Restriction Groups has no Audit history', async ({ page }) => {
    await page.goto('/restrictions');
    const cols = page.getByRole('button', { name: 'Columns' });
    await expect(cols).toBeVisible({ timeout: 60_000 });
    await shot(page, 'BUG-35-restriction-groups-no-audit-history', cols.locator('xpath=..'));
  });

  test('BUG-36 Role screen: singular heading and URL /contacttype', async ({ page }) => {
    await page.goto('/contacttype');
    const h = page.getByRole('heading', { name: /^Role/ }).first();
    await expect(h).toBeVisible({ timeout: 60_000 });
    await shot(page, 'BUG-36-role-heading-singular-url-contacttype', h);
  });

  test('BUG-37 Menu "Flex1" but page heading "Flex 1"', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'Application', 'Flex']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    const item = page.getByRole('button', { name: 'Flex1', exact: true });
    await item.click();
    const h = page.getByRole('heading', { name: /^Flex 1/ }).first();
    await expect(h).toBeVisible({ timeout: 60_000 });
    await shot(page, 'BUG-37-flex-menu-vs-heading', item, h);
  });

  test('BUG-38 Chart of Accounts filter says "Inactive" (Branch etc. say "Deactive")', async ({ page }) => {
    const p = new MasterListPage(page, 'Account', 'Chart of Accounts');
    await p.open('/chartofaccounts');
    await p.openActiveFilter();
    await shot(page, 'BUG-38-accounts-filter-inactive-vs-deactive', page.getByRole('option', { name: 'Inactive' }));
  });

  test('BUG-39 Refund Payouts shows no list and no empty message', async ({ page }) => {
    await page.goto('/refundpayouts');
    const h = page.getByRole('heading', { name: 'Refund Payouts' });
    await expect(h).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(15_000);
    await expect(page.locator('main table')).toHaveCount(0);
    await expect(page.getByText(/no (records|refunds|payouts)|nothing to/i)).toHaveCount(0);
    await shot(page, 'BUG-39-refund-payouts-no-list-or-empty-message', h);
  });

  test('BUG-40 Resource Type popup: "This will mark it as deactive."', async ({ page }) => {
    const p = await popupOf(page, 'Resource Type', 'Resource Types', '/resourcetypes', 'Driver');
    await expect(p.popupText).toHaveText('This will mark it as deactive.');
    await shot(page, 'BUG-40-resource-popup-mark-it-deactive', p.popupText);
    await p.popupCancel.click();
  });

  test('BUG-41 Personnel: empty Personnel Type shows no error (Name does)', async ({ page }) => {
    const p = new MasterListPage(page, 'Personnel', 'Personnel');
    await p.open('/resources/personnel');
    await p.addButton.click();
    const dlg = p.dialog('Add Personnel');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText('Name is required')).toBeVisible();
    await shot(page, 'BUG-41-personnel-type-required-no-message', dlg.getByText(/^Personnel Type\s*\*?$/).first().locator('xpath=..'), dlg.getByText('Name is required'));
  });

  test('BUG-42 Tax Detail: empty form is sent to the server', async ({ page }) => {
    await page.goto('/taxdetail');
    await page.getByRole('button', { name: 'Add Tax Detail' }).click({ timeout: 60_000 });
    const dlg = page.getByRole('dialog').last();
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => blocked.length, { timeout: 10_000 }).toBeGreaterThan(0);
    await shot(page, 'BUG-42-tax-detail-empty-form-sent', dlg);
  });
});

// ---------------- stage build v1.0.2 regressions (BUG-112..117) - writes blocked ----------------
test.describe('Bug evidence - v1.0.2', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  const addRole = async (page: Page) => {
    const p = new MasterListPage(page, 'Role', 'Role');
    await p.open('/contacttype');
    await p.addButton.click();
    const dlg = p.dialog('Add Role');
    return { p, dlg, name: p.field(dlg, 'Name') };
  };

  test('BUG-112 Name stops at 100 characters (150 agreed)', async ({ page }) => {
    const { name } = await addRole(page);
    await name.fill('A'.repeat(150));
    expect((await name.inputValue()).length).toBe(100);
    await shot(page, 'BUG-112-name-limit-100-not-150', name);
  });

  test('BUG-113 Name removes digits and & ( )', async ({ page }) => {
    const { name } = await addRole(page);
    await name.pressSequentially('Zone 2 North-1 & Co (Test)');
    await expect(name).toHaveValue('Zone  North-  Co Test');
    await shot(page, 'BUG-113-name-strips-digits-and-specials', name);
  });

  test('BUG-114 Empty search names the wrong screen ("Contact Type")', async ({ page }) => {
    const p = new MasterListPage(page, 'Role', 'Role');
    await p.open('/contacttype');
    await p.nameSearch.fill('zzzqqq');
    const msg = page.getByText('There are no records in Contact Type');
    await expect(msg).toBeVisible({ timeout: 15_000 });
    await shot(page, 'BUG-114-empty-search-says-contact-type', msg, p.heading);
  });

  test('BUG-115 Currency row opens no Edit', async ({ page }) => {
    const p = new MasterListPage(page, 'Currency', 'Currencies');
    await p.open('/currency');
    await p.search('US Dollar');
    await p.row('US Dollar').locator('td').first().click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await shot(page, 'BUG-115-currency-row-opens-no-edit', p.row('US Dollar'));
  });

  test('BUG-116 Deactivating a record in use gives no "in use" warning', async ({ page }) => {
    const p = await popupOf(page, 'Resource Type', 'Resource Types', '/resourcetypes', 'Driver');
    await expect(p.popupText).not.toHaveText(/in use|used by|linked|assigned/i);
    await shot(page, 'BUG-116-in-use-record-no-warning', p.popup);
    await p.popupCancel.click();
  });

  test('BUG-117 Asset: empty Asset Type gives only a banner "Please select a asset type."', async ({ page }) => {
    const p = new MasterListPage(page, 'Asset', 'Assets');
    await p.open('/resources/assets');
    await p.addButton.click();
    const dlg = p.dialog('Add Asset');
    await p.field(dlg, 'Name').fill('QA Auto Evidence');
    await dlg.getByRole('button', { name: 'Save' }).click();
    const banner = dlg.getByText('Please select a asset type.');
    await expect(banner).toBeVisible();
    await shot(page, 'BUG-117-asset-type-banner-only', banner, dlg.getByText(/^Asset Type\s*\*?$/).first().locator('xpath=..'));
  });
  test('BUG-121 Journal: Post is disabled with no message', async ({ page }) => {
    await openPage(page, '/journals', 'Journals');
    await page.getByRole('button', { name: 'New journal voucher' }).click();
    const dlg = dialogTitled(page, 'New journal voucher');
    const post = dlg.getByRole('button', { name: 'Post journal' });
    await expect(post).toBeDisabled();
    await shot(page, 'BUG-121-journal-post-disabled-no-message', post);
  });

  test('BUG-122 Agent invoice: negative Net gives Total -100.00', async ({ page }) => {
    await openPage(page, '/agentinvoices', 'Agent Invoices');
    await page.getByRole('button', { name: 'Raise invoice' }).click();
    const dlg = dialogTitled(page, 'Raise agent invoice');
    const net = dlg.locator('input[type=number]').first();
    await net.fill('-100');
    const total = dlg.getByText(/Total\s+-100\.00/);
    await expect(total).toBeVisible();
    await shot(page, 'BUG-122-agent-invoice-negative-total', net, total);
  });

  test('BUG-123 Close year enabled with no periods', async ({ page }) => {
    await openPage(page, '/financialperiods', 'Financial Periods');
    const year = String(new Date().getFullYear());
    const none = page.getByText(`No periods for ${year} yet`);
    await expect(none).toBeVisible();
    const close = page.getByRole('button', { name: 'Close year' });
    await expect(close).toBeEnabled();
    await shot(page, 'BUG-123-close-year-enabled-without-periods', close, none);
  });

  test('BUG-126 /flex/11 opens a Flex 11 list', async ({ page }) => {
    await page.goto('/flex/11');
    const h = page.getByRole('heading', { name: 'Flex 11' }).first();
    await expect(h).toBeVisible({ timeout: 60_000 });
    await shot(page, 'BUG-126-flex-11-opens', h);
  });
});
