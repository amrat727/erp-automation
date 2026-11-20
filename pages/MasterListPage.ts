import { Page, Locator, expect } from '@playwright/test';
import { API_HOST } from '../env';

/**
 * ONE page object for ALL master-data list screens (Country, State, City, ...).
 * They are built from the same component, so they share the same layout:
 *   toolbar (Add X / Audit history / Columns) + table (Name search, Active filter, switch, share) + popups.
 */
export class MasterListPage {
  readonly page: Page;
  readonly entity: string;      // "State"
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly auditButton: Locator;
  readonly columnsButton: Locator;
  readonly nameSearch: Locator;
  readonly nameHeader: Locator;
  readonly activeHeader: Locator;
  readonly activeFilter: Locator;
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly rangeText: Locator;
  readonly popup: Locator;
  readonly popupTitle: Locator;
  readonly popupText: Locator;
  readonly popupConfirm: Locator;
  readonly popupCancel: Locator;

  readonly nameCol: number;     // which column holds the Name (Product Type has an icon column first)
  readonly subModule: string;   // menu group under Core: "Region" / "Product"

  constructor(page: Page, entity: string, plural: string, opts: { nameCol?: number; subModule?: string; addLabel?: string } = {}) {
    this.nameCol = opts.nameCol ?? 1;
    this.subModule = opts.subModule ?? 'Region';
    this.page = page;
    this.entity = entity;
    // regex: some headings carry an info icon after the text ("Room Types (i)")
    this.heading = page.getByRole('heading', { name: new RegExp(`^${plural}(\\s|$)`) });
    this.addButton = page.getByRole('button', { name: opts.addLabel ?? `Add ${entity}`, exact: true });
    this.auditButton = page.getByRole('button', { name: 'Audit history' });
    this.columnsButton = page.getByRole('button', { name: 'Columns' });
    // the box is in the Name header, or (some screens) in a separate filter row under it
    // Columns found by content that is ALWAYS in the DOM (stage 20 Nov: the header names change while a filter is open,
    // e.g. "Name" -> "Sort by Name", and the Active header has no name while its list is open). Older layout as fallback.
    this.nameHeader = page.locator('thead th:has(input[placeholder="Search name"])')
      .or(page.getByRole('columnheader', { name: /^Name/ })).first();
    this.activeHeader = page.locator('thead th:has([aria-label="Clear Active filter"])')
      .or(page.getByRole('columnheader', { name: /Active/ })).first();
    this.nameSearch = this.nameHeader.getByRole('textbox')
      .or(page.locator('main thead input[placeholder="Search name"]')).first();
    this.activeFilter = this.activeHeader.getByRole('combobox').first();
    this.rows = page.locator('tbody tr').filter({ has: page.locator('input[type=checkbox]') });
    this.emptyMessage = page.getByText(`There are no records in ${entity}`);
    this.rangeText = page.getByText(/^\d+–\d+ of [\d,]+$/);
    this.popup = page.locator('.swal2-popup');
    this.popupTitle = this.popup.locator('.swal2-title');
    this.popupText = this.popup.locator('.swal2-html-container');
    this.popupConfirm = this.popup.getByRole('button', { name: 'Yes, deactivate' });
    this.popupCancel = this.popup.getByRole('button', { name: 'Cancel' });
  }

  async open(path: string) {
    await this.page.goto(path);
    await expect(this.heading).toBeVisible({ timeout: 60_000 });
    // wait until the table finished loading (rows OR an empty message)
    await expect(this.rows.first().or(this.page.getByText(/no records|yet\./i).first())).toBeVisible({ timeout: 60_000 });
    await this.showFilters();
  }

  /**
   * Stage (20 Nov 2026): the column filters (Name search box, Active dropdown) are HIDDEN until the small icon
   * in that column header is clicked. Reveal both if they are not visible (no-op on the older layout).
   */
  async showFilters(which: 'name' | 'active' = 'name') {
    // only ONE column filter is open at a time (opening "Active" closes the Name box) -> open the one needed
    const [header, control] = which === 'name' ? [this.nameHeader, this.nameSearch] : [this.activeHeader, this.activeFilter];
    if (await control.first().isVisible().catch(() => false)) return;
    const icon = header.locator('span[aria-hidden=true]').first();
    if (!(await icon.count())) return;                   // screen without that column / older layout
    await icon.click({ force: true });                   // decorative icon (aria-hidden) - it only opens the filter
    await control.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }


  async openViaMenu(menuItem: string) {
    await this.page.goto('/dashboard');
    await this.page.getByRole('button', { name: 'Core', exact: true }).click();
    // subModule may be nested: "Accounts > Configuration"
    for (const level of this.subModule.split(' > ')) await this.page.getByRole('button', { name: level, exact: true }).click();
    await this.page.getByRole('button', { name: menuItem, exact: true }).click();
    await expect(this.heading).toBeVisible({ timeout: 60_000 });
    await expect(this.rows.first().or(this.page.getByText(/no records|yet\./i).first())).toBeVisible({ timeout: 60_000 });
    await this.showFilters();
  }

  // ---------- table ----------
  row(name: string): Locator {
    return this.rows.filter({ has: this.page.locator(`td:nth-child(${this.nameCol})`).getByText(name, { exact: true }) });
  }
  toggle(name: string): Locator {
    return this.row(name).locator('input[type=checkbox]');
  }
  async names(): Promise<string[]> {
    return (await this.rows.locator(`td:nth-child(${this.nameCol})`).allInnerTexts()).map(s => s.trim());
  }
  /** Type in the Name search and wait until the table really shows the filtered result */
  async search(text: string) {
    await this.showFilters();
    await this.nameSearch.fill(text);
    await expect(async () => {
      const names = await this.names();
      // any empty text counts here (v1.0.2 shows wrong screen names, e.g. "...in Resource" - checked by test 06)
      const empty = await this.page.getByText(/^There are no records in /).count();
      if (text) expect(empty > 0 || (names.length > 0 && names.every(n => n.toLowerCase().includes(text.toLowerCase())))).toBe(true);
    }).toPass({ timeout: 30_000 });
  }
  /** open the Active dropdown list (stage 20 Nov: revealing the filter may already open the list) */
  async openActiveFilter() {
    await this.showFilters('active');
    if (await this.page.getByRole('listbox').isVisible().catch(() => false)) return;
    await this.activeFilter.click();
    await this.page.getByRole('listbox').waitFor({ timeout: 10_000 });
  }

  async filterActive(option: 'All' | 'Active' | 'Deactive') {
    await this.openActiveFilter();
    // most screens say "Deactive", Province says "Inactive" (reported inconsistency) -> accept both
    const name = option === 'Deactive' ? /^(Deactive|Inactive)$/ : new RegExp(`^${option}$`);
    await this.page.getByRole('option', { name }).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
  /** Click a row's switch. No force-click: Playwright checks it really hits THIS row's switch. */
  async clickToggle(name: string) {
    await expect(this.row(name)).toHaveCount(1);
    await this.toggle(name).click();
  }

  // ---------- add / edit dialog ----------
  dialog(title: string): Locator {
    return this.page.getByRole('dialog').filter({ hasText: title });
  }
  /** Input that follows a visible label like "Name*" (labels are not linked to inputs in this app) */
  field(dialog: Locator, label: string): Locator {
    return dialog.getByText(new RegExp(`^${label}\\s*\\*?$`)).first().locator('xpath=following::input[1]');
  }
  /** Pick a value in a dropdown field */
  async pick(dialog: Locator, label: string, value: string) {
    const f = this.field(dialog, label);
    await f.click();
    await f.fill(value);
    await this.page.getByRole('option', { name: value, exact: true }).click();
    // multi-select lists stay open -> close ONLY the list (Escape on a closed list would close the dialog!)
    if (await this.page.getByRole('listbox').isVisible()) await f.press('Escape');
  }
}

/** Block every save/update/delete request -> the test can NEVER change data. */
export async function blockWrites(page: Page, allow?: RegExp): Promise<string[]> {
  const blocked: string[] = [];
  await page.route(`**/${API_HOST}/**`, route => {
    const r = route.request();
    // `allow` = read-only POSTs that save nothing (e.g. the contract "rate-quote" price check)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.method()) && !/negotiate|\/auth\//.test(r.url()) && !(allow && allow.test(r.url()))) {
      blocked.push(`${r.method()} ${r.url()}`);
      return route.abort();
    }
    return route.continue();
  });
  return blocked;
}

/**
 * Deactivate every ACTIVE record whose name starts with "QA Auto" and contains `tag`.
 * SAFE: filter = Active + search -> only active test records are listed; each one goes
 * through the normal deactivate popup (which only appears for an ACTIVE switch).
 */
export async function deactivateTestRecords(p: MasterListPage, tag = 'QA Auto'): Promise<number> {
  const isOurs = (n: string) => n.startsWith('QA Auto') && n.includes(tag);
  let done = 0;
  for (let guard = 0; guard < 50; guard++) {
    await p.filterActive('Active');
    await p.search(tag);
    // wait until the Active filter really applied: every listed switch is ON (or the list is empty)
    await expect(async () => {
      const states = await p.rows.locator('input[type=checkbox]').evaluateAll(els => els.map(e => (e as HTMLInputElement).checked));
      expect(states.every(Boolean)).toBe(true);
    }).toPass({ timeout: 30_000 });
    const i = (await p.names()).findIndex(isOurs);
    if (i < 0) break;
    const sw = p.rows.nth(i).locator('input[type=checkbox]');
    await expect(sw).toBeChecked();                      // must be ON
    await sw.click();                                    // no force: must really hit this row's switch
    await expect(p.popupConfirm).toBeVisible();          // deactivate popup = it was active
    await p.popupConfirm.click();
    await expect(p.page.getByText(new RegExp(`${p.entity} deactivated`, 'i')).first()).toBeVisible();
    done++;
    await p.page.reload();                               // fresh list for the next round
    await expect(p.heading).toBeVisible({ timeout: 60_000 });
  }
  return done;
}
