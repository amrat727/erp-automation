import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ProductPage } from '../../pages/ProductPage';
import { visible, openDialog } from '../../pages/FormHelpers';

/*
 * CROSS-MODULE CONSISTENCY - every module must manage records the way Core does (product owner, 18 Nov 2026):
 * same Add / Edit / Deactivate behaviour, same list toolbar, and the SAME error pattern (mandatory fields and every other error).
 *
 * THE CORE STANDARD (taken from Country / State / City ... - see tests/core/master-ui.ts):
 *   list   : button "Add <Entity>", "Audit history", "Columns"; a Search box in the Name column; Active filter starting at "All";
 *            no match -> "There are no records in <Entity>"; paging "1–10 of N" + "Page 1 of N"
 *   form   : Save on an empty form sends nothing; under EVERY mandatory field a red "<Field> is required"; no extra banner
 *   delete : a row switch -> popup "Deactivate <entity>?" (warning icon) with "Yes, deactivate" / "Cancel"
 *
 * SAFETY: every save / update / delete request is BLOCKED - nothing in the ERP can change.
 */
const vis = visible;
const dlg = openDialog;
async function waitList(page: Page) {
  await expect(page.locator('main tbody tr:visible').first().or(page.locator('main').getByText(/no records|nothing|yet|^No open/i).first())).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1500);
}
/** every error the user sees: messages under fields, banners, toasts */
async function shown(page: Page, scope: Locator) {
  await page.waitForTimeout(2000);
  const clean = (a: string[]) => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
  return {
    // every RED message shown under a field - found by its colour, because dropdown fields render theirs
    // without the MUI helper-text classes (outside banners / toasts)
    inline: clean(await scope.locator('p, span, div').evaluateAll(els => els
      .filter(e => e.children.length === 0 && (e as HTMLElement).offsetParent !== null && !e.closest('.MuiAlert-root, [role=alert], .MuiInputBase-root, label'))
      .filter(e => { const m = getComputedStyle(e).color.match(/\d+/g)!.map(Number); return m[0] > 150 && m[1] < 90 && m[2] < 90; })
      .map(e => e.textContent ?? ''))).filter(t => t !== '*' && t !== 'Blocked'),
    banner: clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible').allInnerTexts()),
    red: await scope.locator('.MuiInputBase-root.Mui-error:visible').count(),
  };
}

// ======================================================================= LISTS
type ListScreen = { module: string; path: string; entity: string; add?: string; noAdd?: string; known?: Partial<Record<'add' | 'audit' | 'columns' | 'search' | 'empty' | 'paging', string>> };
const LISTS: ListScreen[] = [
  { module: 'Core (standard)', path: '/countries', entity: 'Country' },
  { module: 'Supplier', path: '/suppliers', entity: 'Supplier' },
  { module: 'Agent', path: '/agents', entity: 'Agent' },
  { module: 'Contracts', path: '/contracts', entity: 'Contract' },
  { module: 'Package', path: '/packages', entity: 'Package' },
  { module: 'Enquiries', path: '/enquiries', entity: 'Enquiry' },
  { module: 'Quotes', path: '/quotes', entity: 'Quote' },
  { module: 'Reservation', path: '/reservations', entity: 'Reservation' },
  { module: 'Company', path: '/companies', entity: 'Company' },
];
// filled in after the first run: the module that differs -> BUG id (test.fail keeps the suite green while the bug is open)
const KNOWN: Record<string, string> = {
  'Supplier-add': 'BUG-81: button says "Add supplier" (small s) - Core / Agent / Quote say "Add Country" / "Add Agent" / "Add Quote"',
  'Package-add': 'BUG-82: button says "Add New" instead of "Add Package"',
  'Enquiry-add': 'BUG-83: Enquiries list is built differently ("New enquiry", one top search, "No open enquiries.", no paging)',
  'Enquiry-search': 'BUG-83: Enquiries list has no column search',
  'Enquiry-empty': 'BUG-83: Enquiries says "No open enquiries." instead of "There are no records in Enquiry"',
  'Enquiry-paging': 'BUG-83: Enquiries list has no paging',
  'Contract-add': 'BUG-84: Contracts list has no "Add Contract"',
  'Contract-audit': 'BUG-84: Contracts list has no "Audit history" / "Columns"',
  'Contract-search': 'BUG-84: Contracts list has no column search',
  'Contract-empty': 'BUG-84: Contracts list has no column search / standard empty message',
  'Agent-audit': 'BUG-85: Agent list has no "Audit history"',
  'Package-audit': 'BUG-85: Package list has no "Audit history"',
  'Company-search': 'BUG-86: Company list has no column search',
  'Company-empty': 'BUG-86: Company list has no column search / standard empty message',
  'Company-paging': 'BUG-86: Company list has no paging',
  'status-words': 'BUG-87: Supplier says "On hold", Agent says "On Hold"',
  'active-words': 'BUG-88: Quotes / Reservation filter says "Inactive", Core / Package say "Deactive"',
  'SupplierAddsupplier-banner': 'BUG-89: extra popup "Please fix the highlighted fields." (Core forms show only the field messages)',
  'AgentAddAgent-banner': 'BUG-89: extra popup "Please fix the highlighted fields."',
  'QuotesAddQuote-banner': 'BUG-89: extra popup "Please fix the highlighted fields."',
  'ReservationAddReservation-banner': 'BUG-89: extra popup "Please fix the highlighted fields."',
  'SupplierAddsupplier-msg': 'BUG-90: City says "Choose a city." instead of "City is required"',
  'AgentAddAgent-msg': 'BUG-90: "Agent Name is required" / "Select a default currency" instead of "Name is required" / "Default currency is required"',
  'ReservationAddReservation-msg': 'BUG-90: field "Travel Dates" says "Arrival Date is required"',
  'PortalCMSAddcheckoutfield-msg': 'BUG-90: "Give the field a label." instead of "Label is required"',
  'SupplierAddroom-msg': 'BUG-91: room says "Enter a room name." / "Select a view." + a numbered list "Some fields need attention: 1. ... 2. ..."',
  'SupplierAddroom-banner': 'BUG-91: room errors are also listed in a numbered banner',
  'AgentAddcurrency-msg': 'BUG-92: only a banner "Please select a currency." - nothing under the field, field not red',
  'AgentAddcurrency-banner': 'BUG-92: banner only, field not red',
  'AgentAddwallettopup-msg': 'BUG-92: only a banner "Enter an amount greater than zero." - nothing under the field, field not red',
  'AgentAddwallettopup-banner': 'BUG-92: banner only, field not red',
  'PortalCMSNewoffer-msg': 'BUG-93: Portal CMS shows one banner for the first missing field ("Give the offer a heading."), fields not marked',
  'PortalCMSNewoffer-banner': 'BUG-93: Portal CMS: banner instead of field messages',
  'PortalCMSNewdocument-sent': 'BUG-94: an EMPTY document (no Name) is sent to the server',
  'PortalCMSNewdocument-msg': 'BUG-94: no "Name is required"',
  'PortalCMSNewdocument-banner': 'BUG-94: no mandatory-field check',
  'deact-supplier': 'BUG-95: Supplier list has no Active switch / "Deactivate supplier?" popup (status Blocked in Edit instead)',
  'deact-agent': 'BUG-95: Agent list has no Active switch / "Deactivate agent?" popup (status Blocked in Edit instead)',
};
const known = (key: string) => { if (KNOWN[key]) test.fail(true, KNOWN[key]); };

test.describe('Lists look and work like Core', () => {
  test.setTimeout(150_000);
  for (const s of LISTS) {
    test.describe(s.module, () => {
      let blocked: string[];
      test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); await page.goto(s.path); await waitList(page); });

      test(`TC-CONS-${s.entity}-01: Toolbar button is "Add ${s.entity}"`, async ({ page }) => {
        test.skip(s.entity === 'Company', 'one company per login - no Add expected');
        known(`${s.entity}-add`);
        const any = page.locator('main').getByRole('button', { name: /^(\+\s*)?(Add|New|Create)\b/i });
        console.log(`${s.module} add buttons: ${JSON.stringify(await any.allInnerTexts())}`);
        await expect(vis(page.locator('main').getByRole('button', { name: `Add ${s.entity}`, exact: true }))).toBeVisible({ timeout: 5_000 });
      });

      test(`TC-CONS-${s.entity}-02: Toolbar has "Audit history" and "Columns"`, async ({ page }) => {
        known(`${s.entity}-audit`);
        await expect(vis(page.getByRole('button', { name: 'Columns' }))).toBeVisible({ timeout: 5_000 });
        await expect(vis(page.getByRole('button', { name: 'Audit history' }))).toBeVisible({ timeout: 5_000 });
      });

      test(`TC-CONS-${s.entity}-03: Columns can be searched ("Search" box in the header)`, async ({ page }) => {
        known(`${s.entity}-search`);
        await expect(vis(page.locator('main thead input[placeholder="Search"]'))).toBeVisible({ timeout: 5_000 });
      });

      test(`TC-CONS-${s.entity}-04: No match shows "There are no records in ${s.entity}" and "0–0 of 0"`, async ({ page }) => {
        known(`${s.entity}-empty`);
        const box = vis(page.locator('main thead input[placeholder="Search"]'));
        await box.fill('zzzqqq', { timeout: 5_000 });
        await page.waitForTimeout(4000);
        console.log(`${s.module} no-match text: ${(await page.locator('main tbody').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)}`);
        await expect(page.getByText(`There are no records in ${s.entity}`)).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('0–0 of 0')).toBeVisible();
      });

      test(`TC-CONS-${s.entity}-05: Paging shows "1–N of N" and "Page 1 of N"`, async ({ page }) => {
        known(`${s.entity}-paging`);
        await expect(page.getByText(/^\d+–\d+ of [\d,]+$/).first()).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText(/^Page \d+ of \d+$/).first()).toBeVisible();
        expect(blocked).toHaveLength(0);
      });
    });
  }
});

// ======================================================================= STATUS FILTER WORDING
test.describe('Status words are the same everywhere', () => {
  test.setTimeout(150_000);
  const options = async (page: Page, path: string, header: RegExp) => {
    await page.goto(path); await waitList(page);
    await vis(page.getByRole('columnheader', { name: header }).getByRole('combobox')).click();
    const o = (await page.getByRole('option').allInnerTexts()).map(t => t.trim());
    await page.keyboard.press('Escape');
    return o;
  };
  test('TC-CONS-STATUS-01: Supplier and Agent status filters use the same words (On hold / On Hold)', async ({ page }) => {
    known('status-words');
    await blockWrites(page);
    const sup = await options(page, '/suppliers', /^Status/);
    const ag = await options(page, '/agents', /^Status/);
    console.log(`Supplier: ${JSON.stringify(sup)}  Agent: ${JSON.stringify(ag)}`);
    expect(ag).toEqual(sup);
  });
  test('TC-CONS-STATUS-02: Every Active filter offers All / Active / Deactive like Core', async ({ page }) => {
    known('active-words');
    await blockWrites(page);
    const out: Record<string, string[]> = {};
    for (const [m, p] of [['Core', '/countries'], ['Package', '/packages'], ['Quotes', '/quotes'], ['Reservation', '/reservations']]) out[m] = await options(page, p, /^Active/);
    console.log(JSON.stringify(out));
    for (const m of Object.keys(out)) expect(out[m], m).toEqual(out.Core);
  });
});

// ======================================================================= EMPTY SAVE (mandatory fields)
type Form = { module: string; name: string; open: (page: Page) => Promise<void>; dialog: boolean; required: string[]; save?: string };
const SUP = 18, AG = 6;
const FORMS: Form[] = [
  { module: 'Core (standard)', name: 'Add State', dialog: true, required: ['Name'],   // Country only gets a banner - already BUG-11
    open: async page => { await page.goto('/states'); await waitList(page); await page.getByRole('button', { name: 'Add State', exact: true }).click(); } },
  { module: 'Supplier', name: 'Add supplier', dialog: false, required: ['Name', 'City', 'Default currency']   /* Payment due is pre-filled */, save: 'Create supplier',
    open: async page => { await page.goto('/suppliers/new'); await expect(page.getByRole('button', { name: 'Create supplier' })).toBeVisible({ timeout: 90_000 }); } },
  { module: 'Supplier', name: 'Add contact', dialog: true, required: ['Name', 'Role'],
    open: async page => { await page.goto(`/suppliers/${SUP}/contacts`); await page.waitForTimeout(3000); await vis(page.getByRole('button', { name: 'Add contact', exact: true })).click({ timeout: 90_000 }); } },
  { module: 'Supplier', name: 'Add currency', dialog: true, required: ['Currency']   /* Payment due is pre-filled */,
    open: async page => { await page.goto(`/suppliers/${SUP}/financials`); await page.getByRole('button', { name: /Add currency$/ }).last().click({ timeout: 90_000 }); } },
  { module: 'Supplier', name: 'Add bank account', dialog: true, required: ['Account holder', 'Bank'],
    open: async page => { await page.goto(`/suppliers/${SUP}/financials`); await vis(page.getByRole('button', { name: 'Add bank account' })).click({ timeout: 90_000 }); } },
  { module: 'Supplier', name: 'Add room', dialog: false, required: ['Room name', 'View'], save: 'Create product',
    open: async page => { await new ProductPage(page).open(SUP, 'Hotel'); await vis(page.locator('main').getByRole('button', { name: /^Add room/ })).click({ timeout: 90_000 }); } },
  { module: 'Agent', name: 'Add Agent', dialog: false, required: ['Name', 'Email', 'Default currency'], save: 'Create agent',
    open: async page => { await page.goto('/agents/new'); await expect(page.locator('main input:visible').first()).toBeVisible({ timeout: 90_000 }); await page.waitForTimeout(2000); } },
  { module: 'Agent', name: 'Add currency', dialog: true, required: ['Currency'],
    open: async page => { await page.goto(`/agents/${AG}/financials`); await vis(page.getByRole('button', { name: 'Add currency', exact: true })).click({ timeout: 90_000 }); } },
  { module: 'Agent', name: 'Add wallet top-up', dialog: true, required: ['Amount'],
    open: async page => { await page.goto(`/agents/${AG}/financials`); await vis(page.getByRole('button', { name: 'Add top-up', exact: true })).click({ timeout: 90_000 }); } },
  { module: 'Quotes', name: 'Add Quote', dialog: false, required: ['Agent', 'Currency', 'Exchange Type', 'Date', 'Name'], save: 'Save Quote',
    open: async page => { await page.goto('/quotes/new'); await expect(page.getByRole('button', { name: 'Save Quote' })).toBeVisible({ timeout: 90_000 }); await page.waitForTimeout(2000); } },
  { module: 'Reservation', name: 'Add Reservation', dialog: false, required: ['Travel Dates', 'Agent', 'Currency', 'Exchange Type'], save: 'Save Reservation',
    open: async page => { await page.goto('/reservations/new'); await expect(page.getByRole('button', { name: 'Save Reservation' })).toBeVisible({ timeout: 90_000 }); await page.waitForTimeout(2000); } },
  { module: 'Portal CMS', name: 'New offer', dialog: true, required: ['Heading', 'Image'], save: 'Save and publish',
    open: async page => { await page.goto('/portal-cms/offers'); await vis(page.getByRole('button', { name: 'New offer', exact: true })).click({ timeout: 90_000 }); } },
  { module: 'Portal CMS', name: 'New document', dialog: true, required: ['Name'], save: 'Save and publish',
    open: async page => { await page.goto('/portal-cms/documents'); await vis(page.getByRole('button', { name: 'New document', exact: true })).click({ timeout: 90_000 }); } },
  { module: 'Portal CMS', name: 'Add checkout field', dialog: true, required: ['Label'], save: 'Add',
    open: async page => { await page.goto('/portal-cms/checkout'); await vis(page.getByRole('button', { name: 'Add field', exact: true })).click({ timeout: 90_000 }); } },
];

test.describe('Mandatory-field errors follow the Core pattern', () => {
  test.setTimeout(150_000);
  for (const f of FORMS) {
    const key = `${f.module}-${f.name}`.replace(/[^A-Za-z]+/g, '');
    test.describe(`${f.module}: ${f.name}`, () => {
      let blocked: string[];
      let scope: Locator;
      test.beforeEach(async ({ page }) => {
        blocked = await blockWrites(page);
        await f.open(page);
        // dialogs and side drawers (Enquiries / Portal CMS); the left menu is also a drawer, so only right-hand ones
        scope = f.dialog ? page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last() : page.locator('main');
        if (f.dialog) await expect(scope).toBeVisible({ timeout: 30_000 });
        const save = f.save ? vis(scope.getByRole('button', { name: f.save, exact: true })) : scope.getByRole('button', { name: /^(Save|Add)$/ }).last();
        await save.click({ timeout: 30_000 });
      });

      test(`TC-CONS-${key}-01: Empty Save sends nothing to the server`, async () => {
        known(`${key}-sent`);
        expect(blocked, 'an empty form must not be sent').toHaveLength(0);
      });

      test(`TC-CONS-${key}-02: Each mandatory field says "<Field> is required" under it (${f.required.join(', ')})`, async ({ page }) => {
        known(`${key}-msg`);
        const s = await shown(page, scope);
        console.log(`${f.module} ${f.name}: ${JSON.stringify(s)}`);
        for (const r of f.required) expect(s.inline, `"${r} is required" under the field`).toContain(`${r} is required`);
      });

      test(`TC-CONS-${key}-03: Errors are shown under the fields only - no extra banner / list at the top`, async ({ page }) => {
        known(`${key}-banner`);
        const s = await shown(page, scope);
        expect(s.banner, 'banner shown instead of / besides the field messages').toEqual([]);
        expect(s.red, 'mandatory fields are marked red').toBeGreaterThanOrEqual(f.required.length);
      });
    });
  }
});

// ======================================================================= OTHER ERRORS: same wording for the same problem
test.describe('Same problem -> same message', () => {
  test.setTimeout(200_000);
  test('TC-CONS-MSG-01: An invalid e-mail gets the same message in Supplier contact, Agent add and Agent address', async ({ page }) => {
    known('email-msg');
    await blockWrites(page);
    const msgs: Record<string, string[]> = {};
    // supplier contact
    await page.goto(`/suppliers/${SUP}/contacts`);
    await page.waitForTimeout(3000);
    await vis(page.getByRole('button', { name: 'Add contact', exact: true })).click({ timeout: 90_000 });
    await dlg(page).getByPlaceholder('Full name').fill('QA Auto email check');
    await dlg(page).getByPlaceholder('name@company.com').fill('abc');
    await dlg(page).getByRole('button', { name: 'Save' }).click();
    msgs['Supplier contact'] = (await shown(page, dlg(page))).inline.concat((await shown(page, dlg(page))).banner);
    // agent add
    await page.goto('/agents/new');
    await expect(page.locator('main input:visible').first()).toBeVisible({ timeout: 90_000 });
    const email = page.locator('main input[type=email]:visible, main input[placeholder*="@"]:visible').first();
    await email.fill('abc');
    await vis(page.locator('main').getByRole('button', { name: 'Create agent', exact: true })).click();
    msgs['Agent add'] = (await shown(page, page.locator('main'))).inline.filter(m => /mail/i.test(m));
    console.log(JSON.stringify(msgs));
    const all = Object.values(msgs).flat().filter(m => /mail/i.test(m));
    expect(all.length, 'an e-mail message is shown').toBeGreaterThan(1);
    expect(new Set(all).size, `different wording: ${JSON.stringify(all)}`).toBe(1);
  });
});

// ======================================================================= DEACTIVATE
type Deact = { module: string; path: string; entity: string };
const SWITCH_SCREENS: Deact[] = [
  { module: 'Core (standard)', path: '/countries', entity: 'country' },
  { module: 'Package', path: '/packages', entity: 'package' },
  { module: 'Quotes', path: '/quotes', entity: 'quote' },
  { module: 'Reservation', path: '/reservations', entity: 'reservation' },
  { module: 'Contracts', path: '/contracts', entity: 'contract' },
];
test.describe('Deactivate works like Core', () => {
  test.setTimeout(150_000);
  for (const s of SWITCH_SCREENS) {
    test(`TC-CONS-DEACT-${s.entity}: ${s.module} - switch opens "Deactivate ${s.entity}?" with Yes, deactivate / Cancel; Cancel keeps it`, async ({ page }) => {
      known(`deact-${s.entity}`);
      const blocked = await blockWrites(page);
      await page.goto(s.path); await waitList(page);
      const sw = page.locator('main tbody tr:visible input[type=checkbox][aria-label=Active]:checked').first();   // not the Package "Published" switch
      test.skip(!(await sw.count()), 'no active row');
      await sw.click();
      const pop = page.locator('.swal2-popup:visible');
      await expect(pop, 'a confirmation popup').toBeVisible({ timeout: 5_000 });
      console.log(`${s.module}: ${(await pop.innerText()).replace(/\s+/g, ' ')}`);
      await expect(pop).toHaveClass(/swal2-icon-warning/);
      await expect(pop.locator('.swal2-title')).toHaveText(`Deactivate ${s.entity}?`);
      await expect(pop.getByRole('button', { name: 'Yes, deactivate' })).toBeVisible();
      await pop.getByRole('button', { name: 'Cancel' }).click();
      await expect(sw).toBeChecked();
      expect(blocked, 'Cancel sends nothing').toHaveLength(0);
    });
  }
  for (const s of [{ module: 'Supplier', path: '/suppliers', entity: 'supplier' }, { module: 'Agent', path: '/agents', entity: 'agent' }]) {
    test(`TC-CONS-DEACT-${s.entity}: ${s.module} - list has an Active switch per row like Core`, async ({ page }) => {
      known(`deact-${s.entity}`);
      await blockWrites(page);
      await page.goto(s.path); await waitList(page);
      await expect(page.locator('main tbody tr:visible input[type=checkbox]').first(), 'no Active switch - deactivating works differently (Status = Blocked in Edit)').toBeVisible({ timeout: 5_000 });
    });
  }
});
