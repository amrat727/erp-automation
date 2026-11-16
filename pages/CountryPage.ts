import { Page, Locator, expect } from '@playwright/test';

const API = 'https://pilottest.runasp.net/core/region/countries';

/** Page Object for Core > Region > Country (/countries) */
export class CountryPage {
  readonly page: Page;
  // page
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly auditButton: Locator;
  readonly columnsButton: Locator;
  readonly nameSearch: Locator;
  readonly activeFilter: Locator;
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly rangeText: Locator;
  // add dialog
  readonly dialog: Locator;
  readonly nameField: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly nameRequired: Locator;
  // confirmation popup (SweetAlert)
  readonly popup: Locator;
  readonly popupTitle: Locator;
  readonly popupText: Locator;
  readonly popupConfirm: Locator;
  readonly popupCancel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Countries' });
    this.addButton = page.getByRole('button', { name: 'Add Country' });
    this.auditButton = page.getByRole('button', { name: 'Audit history' });
    this.columnsButton = page.getByRole('button', { name: 'Columns' });
    this.nameSearch = page.getByRole('textbox', { name: 'Search' }); // column search (not the global one)
    this.activeFilter = page.getByRole('columnheader', { name: /Active/ }).getByRole('combobox');
    this.rows = page.locator('tbody tr').filter({ has: page.locator('input[type=checkbox]') });
    this.emptyMessage = page.getByText('There are no records in Country');
    this.rangeText = page.getByText(/^\d+–\d+ of \d+$/);

    this.dialog = page.getByRole('dialog').filter({ hasText: 'Add Country' });
    this.nameField = this.dialog.getByRole('combobox');
    this.saveButton = this.dialog.getByRole('button', { name: 'Save' });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancel' });
    this.closeButton = this.dialog.getByRole('button', { name: 'Close' });
    this.nameRequired = this.dialog.getByText('Name is required');

    this.popup = page.locator('.swal2-popup');
    this.popupTitle = this.popup.locator('.swal2-title');
    this.popupText = this.popup.locator('.swal2-html-container');
    this.popupConfirm = this.popup.getByRole('button', { name: 'Yes, deactivate' });
    this.popupCancel = this.popup.getByRole('button', { name: 'Cancel' });
  }

  // ---------- navigation ----------
  async open() {
    await this.page.goto('/countries');
    await expect(this.heading).toBeVisible({ timeout: 60_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 60_000 });
  }

  async openViaMenu() {
    await this.page.goto('/dashboard');
    await this.page.getByRole('button', { name: 'Core', exact: true }).click();
    await this.page.getByRole('button', { name: 'Region', exact: true }).click();
    await this.page.getByRole('button', { name: 'Country', exact: true }).click();
    await expect(this.heading).toBeVisible({ timeout: 60_000 });
  }

  // ---------- table helpers ----------
  row(name: string): Locator {
    return this.rows.filter({ has: this.page.locator('td').first().getByText(name, { exact: true }) });
  }
  toggle(name: string): Locator {
    return this.row(name).locator('input[type=checkbox]');
  }
  async names(): Promise<string[]> {
    return (await this.rows.locator('td:first-child').allInnerTexts()).map(s => s.trim());
  }

  /** Type into the Name search and wait until the TABLE shows the filtered result */
  async search(text: string) {
    const encoded = encodeURIComponent(text).replace(/%20/g, '+');
    await Promise.all([
      this.page.waitForResponse(r => r.url().startsWith(API + '?') && r.request().method() === 'GET' &&
        (text ? r.url().includes(`Filters%5Bname%5D=${encoded}`) || r.url().includes(`Filters%5Bname%5D=${encodeURIComponent(text)}`) : !r.url().includes('Filters'))),
      this.nameSearch.fill(text),
    ]);
    // wait for the table to re-draw: every row must contain the search text (or the empty message)
    if (text) {
      await expect(async () => {
        const names = await this.names();
        const empty = await this.emptyMessage.count();
        expect(empty > 0 || (names.length > 0 && names.every(n => n.toLowerCase().includes(text.toLowerCase())))).toBe(true);
      }).toPass({ timeout: 20_000 });
    }
  }

  async filterActive(option: 'All' | 'Active' | 'Deactive') {
    await this.activeFilter.click();
    await Promise.all([
      this.page.waitForResponse(r => r.url().startsWith(API + '?')),
      this.page.getByRole('option', { name: option, exact: true }).click(),
    ]);
  }

  /** Click the switch of a country (opens the popup when deactivating) */
  async clickToggle(name: string) {
    // NO force: Playwright checks the click really lands on THIS row's switch
    // (a forced click once hit another row while the table was re-drawing).
    await expect(this.row(name)).toHaveCount(1);
    await this.toggle(name).click();
  }

  // ---------- add ----------
  async openAddDialog() {
    await this.addButton.click();
    await expect(this.dialog).toBeVisible();
  }

  async chooseCountry(name: string) {
    await this.nameField.click();
    await this.nameField.fill(name);
    await this.page.getByRole('option', { name, exact: true }).click();
  }

  // ---------- API helpers (to pick test data, not to test) ----------
  private async api<T>(url: string): Promise<T> {
    return this.page.evaluate(async u => {
      const res = await fetch(u, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
      return res.json();
    }, url);
  }

  /** A country from the dropdown list that is NOT yet added for this company */
  async pickUnusedCountry(): Promise<string> {
    const all = await this.api<{ name: string }[]>(`${API}/reference`);
    const added = await this.api<{ items: { name: string }[] }>(`${API}?page=1&pageSize=1000`);
    const used = new Set(added.items.map(c => c.name));
    const free = all.map(c => c.name).filter(n => !used.has(n)).sort();
    if (!free.length) throw new Error('No unused countries left in the dropdown');
    return free[0];
  }

  /** All countries that are currently ACTIVE (from the server) */
  async activeCountryNames(): Promise<string[]> {
    const added = await this.api<{ items: { name: string; isActive: boolean }[] }>(`${API}?page=1&pageSize=1000`);
    return added.items.filter(c => c.isActive).map(c => c.name);
  }
}
