import { Locator, Page, expect } from '@playwright/test';

/**
 * Page Object for Agent (menu: Agent -> /agents).
 *
 * Like Supplier, the app keeps every opened page in hidden in-app tabs and the agent LIST stays on screen
 * beside the detail pages, so locators end with ":visible" and detail-page buttons are picked with care.
 */
export class AgentPage {
  readonly page: Page;
  // ----- list -----
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly creditRequestsButton: Locator;
  readonly columnsButton: Locator;
  readonly nameSearch: Locator;
  readonly emailSearch: Locator;
  readonly countryFilter: Locator;
  readonly statusFilter: Locator;
  readonly rows: Locator;
  readonly rangeText: Locator;
  // ----- add form -----
  readonly name: Locator;
  readonly email: Locator;
  readonly country: Locator;
  readonly state: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Agents', exact: true }).first();
    this.addButton = page.getByRole('button', { name: 'Add Agent', exact: true });
    this.creditRequestsButton = page.getByRole('button', { name: /^Credit Requests/ });
    this.columnsButton = page.getByRole('button', { name: 'Columns' });
    // older layout: box inside the header; stage 20 Nov 2026: box in a filter row, placeholder 'Search name'
    this.nameSearch = page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').or(page.locator('main thead input[placeholder="Search name"]'));
    this.emailSearch = page.getByRole('columnheader', { name: /^Email/ }).getByRole('textbox').or(page.locator('main thead input[placeholder="Search email"]'));
    this.countryFilter = page.getByRole('columnheader', { name: /^Country/ }).getByRole('combobox');
    this.statusFilter = page.getByRole('columnheader', { name: /Status/ }).getByRole('combobox');
    this.rows = page.locator('main tbody tr:visible');
    this.rangeText = page.getByText(/^\d+–\d+ of \d+$/).first();

    // stage 24 Nov 2026: new Add Agent layout - placeholders "Agent trading name", "Enter email", "Search countries", "Search states"
    this.name = page.locator('main input[placeholder="Agent name"]:visible, main input[placeholder="Agent trading name"]:visible').first();
    this.email = page.locator('main input[placeholder="agency@example.com"]:visible, main input[placeholder="Enter email"]:visible').first();
    this.country = page.locator('main input[placeholder="Country"]:visible, main input[placeholder="Search countries"]:visible').first();
    this.state = page.locator('main input[placeholder="State"]:visible, main input[placeholder="Search states"]:visible').first();
    this.createButton = page.getByRole('button', { name: /^Create agent$/i });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
  }

  /** Visible text on the page */
  text(t: string | RegExp): Locator {
    return typeof t === 'string'
      ? this.page.locator(`main :text-is("${t}"):visible`).first()
      : this.page.locator('main :visible').getByText(t).first();
  }

  async open() {
    await this.page.goto('/agents');
    await expect(this.heading).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 60_000 });
  }

  async openAdd() {
    await this.open();
    await this.addButton.click();
    // stage 24 Nov 2026: the page title "Add Agent" is not a heading element any more
    await expect(this.page.locator('main').getByText(/^Add agent$/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(this.name).toBeVisible();
  }

  /** Open an existing agent from the list by name */
  async openAgent(name: string) {
    await this.search(name);
    await this.rows.filter({ hasText: name }).first().locator('td').first().click();
    await expect(this.tab('Overview')).toBeVisible({ timeout: 60_000 });
    await expect(this.page.getByRole('heading', { name, exact: true }).first()).toBeVisible({ timeout: 60_000 });
  }

  async search(name: string) {
    await this.reveal(/^Name/, this.nameSearch);
    // fallback if the box still cannot be opened: biggest page, the caller filters the rows
    if (!(await this.nameSearch.first().isVisible().catch(() => false))) {
      await this.showAllRows();
      return;
    }
    await this.nameSearch.first().fill(name);
    await expect(async () => {
      const texts = await this.rows.allInnerTexts();
      expect(texts.length === 0 || texts.every(t => t.toLowerCase().includes(name.trim().toLowerCase()))).toBe(true);
    }).toPass({ timeout: 30_000 });
  }

  /**
   * Stage (20 Nov 2026): the column filters are HIDDEN until the small icon in that column header is clicked
   * (same change as MasterListPage.showFilters). Opening one filter can close another, so open only the one needed.
   */
  async reveal(header: RegExp, control: Locator) {
    if (await control.first().isVisible().catch(() => false)) return;
    const icon = this.page.getByRole('columnheader', { name: header }).first().locator('span[aria-hidden=true]').first();
    if (!(await icon.count())) return;
    await icon.click({ force: true });                     // decorative icon - only opens the filter
    await control.first().waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }

  /** Pick the largest "Rows per page" so every agent is on one page */
  async showAllRows() {
    const perPage = this.page.locator('main').getByRole('combobox').filter({ hasText: /^\d+$/ }).last();
    if (await perPage.count()) {
      await perPage.click();
      const opts = this.page.getByRole('option');
      await opts.last().click();
      await this.page.waitForTimeout(2000);
    }
  }

  async filterStatus(option: 'All' | 'Approved' | 'On Hold' | 'Blocked') {
    await this.reveal(/Status/, this.statusFilter);
    await this.statusFilter.first().click();
    await this.page.getByRole('option', { name: option, exact: true }).click();
    await this.page.waitForTimeout(1500);
  }

  /** Text of one column of each visible row (1 = Code, 2 = Name, 3 = Email, 4 = Country, 5 = Status) */
  async column(n: number): Promise<string[]> {
    return (await this.rows.locator(`td:nth-child(${n})`).allInnerTexts()).map(s => s.trim());
  }

  tab(name: 'Overview' | 'Addresses' | 'Financials' | 'Access' | 'On-behalf activity'): Locator {
    return this.page.getByRole('tab', { name, exact: true }).first();
  }

  statusButton(name: 'Approved' | 'On Hold' | 'Blocked'): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }
}
