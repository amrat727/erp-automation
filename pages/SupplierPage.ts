import { Locator, Page, expect } from '@playwright/test';

/**
 * Page Object for Supplier (menu: Supplier -> /suppliers).
 *
 * IMPORTANT: this app keeps every opened page in hidden in-app tabs
 * ("Add Supplier x  >  Testing season 3 x"), so the same field can exist several times
 * in the page. Every CSS locator here ends with ":visible" so it only finds the page on screen.
 */
export class SupplierPage {
  readonly page: Page;
  // ----- list -----
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly auditButton: Locator;
  readonly columnsButton: Locator;
  readonly nameSearch: Locator;
  readonly codeSearch: Locator;
  readonly statusFilter: Locator;
  readonly rows: Locator;
  readonly emptyMessage: Locator;
  readonly rangeText: Locator;
  // ----- add form -----
  readonly name: Locator;
  readonly city: Locator;
  readonly currency: Locator;
  readonly branch: Locator;
  readonly department: Locator;
  readonly days: Locator;
  readonly advance: Locator;
  readonly advanceDue: Locator;
  readonly serviceSearch: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly fixFieldsToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /^Suppliers/ });
    this.addButton = page.getByRole('button', { name: 'Add supplier', exact: true });
    this.auditButton = page.getByRole('button', { name: 'Audit history' });
    this.columnsButton = page.getByRole('button', { name: 'Columns' });
    this.nameSearch = page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox');
    this.codeSearch = page.getByRole('columnheader', { name: /^Code/ }).getByRole('textbox');
    this.statusFilter = page.getByRole('columnheader', { name: /Status/ }).getByRole('combobox');
    this.rows = page.locator('main tbody tr:visible');
    this.emptyMessage = page.getByText('There are no records in Supplier').first();
    this.rangeText = page.getByText(/^\d+–\d+ of \d+$/).first();

    this.name = page.locator('main input[placeholder="Supplier trading name"]:visible');
    this.city = page.locator('main input[placeholder="Search cities"]:visible');
    this.currency = page.locator('main input[placeholder="Select a currency"]:visible');
    this.branch = page.locator('main input[placeholder="Select a branch"]:visible');
    this.department = page.locator('main input[placeholder="Select a department"]:visible');
    this.days = page.locator('main input[placeholder="Number of days"]:visible');
    this.advance = page.locator('main input[type=number]:visible').nth(1);
    this.advanceDue = page.locator('main input[type=number][placeholder="Optional"]:visible');
    this.serviceSearch = page.locator('main input[placeholder="Find a service"]:visible');
    this.createButton = page.getByRole('button', { name: 'Create supplier' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.fixFieldsToast = page.getByText('Please fix the highlighted fields.');
  }

  /** Visible text on the page (error messages etc.) */
  text(t: string | RegExp): Locator {
    return typeof t === 'string'
      ? this.page.locator(`main :text-is("${t}"):visible`).first()
      : this.page.locator('main :visible').getByText(t).first();
  }

  async open() {
    await this.page.goto('/suppliers');
    await expect(this.heading).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first().or(this.emptyMessage)).toBeVisible({ timeout: 60_000 });
  }

  async openAdd() {
    await this.open();
    await this.addButton.click();
    await expect(this.page.getByRole('heading', { name: /^Add supplier/ })).toBeVisible({ timeout: 60_000 });
    await expect(this.name).toBeVisible();
  }

  /** Open an existing supplier from the list by name */
  async openSupplier(name: string) {
    await this.search(name);
    await this.rows.filter({ hasText: name }).first().locator('td').first().click();
    await expect(this.tab('Overview')).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByRole('heading', { name, exact: true }).or(this.page.locator(`main :text-is("${name}"):visible`)).first()).toBeVisible();
  }

  async search(name: string) {
    await this.nameSearch.fill(name);
    await expect(async () => {
      const texts = await this.rows.allInnerTexts();
      expect(texts.length === 0 || texts.every(t => t.toLowerCase().includes(name.trim().toLowerCase()))).toBe(true);
    }).toPass({ timeout: 30_000 });
  }

  async filterStatus(option: 'All' | 'Approved' | 'On hold' | 'Blocked') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await this.page.waitForTimeout(1500);
  }

  /** Status cell of each visible row */
  async statuses(): Promise<string[]> {
    return (await this.rows.locator('td:nth-child(3)').allInnerTexts()).map(s => s.trim());
  }

  async names(): Promise<string[]> {
    return (await this.rows.locator('td:nth-child(1)').allInnerTexts()).map(s => s.trim());
  }

  /** Type in a searchable dropdown and pick the first option that matches */
  async pick(input: Locator, typed: string, option: string | RegExp = typed) {
    await input.click();
    await input.fill(typed);
    await this.page.getByRole('option', { name: option }).first().click({ timeout: 30_000 });
  }

  statusButton(name: 'Approved' | 'On hold' | 'On Hold' | 'Blocked'): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  /** Service chip, e.g. "Hotel", "Private transfer" */
  service(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${name}(\\s*·\\s*\\d+)?$`) });
  }

  tab(name: 'Overview' | 'Contacts' | 'Products' | 'Financials' | 'Content'): Locator {
    return this.page.getByRole('tab', { name });
  }

  /** The visible dialog with this title */
  dialog(title: string | RegExp): Locator {
    return this.page.getByRole('dialog').filter({ hasText: title }).last();
  }

  /** Fill the minimum required fields of the Add form */
  async fillRequired(name: string, city = 'Dubai', currency = 'AED') {
    await this.name.fill(name);
    await this.pick(this.city, city, new RegExp(city));
    await this.pick(this.currency, currency, new RegExp(currency));
  }
}
