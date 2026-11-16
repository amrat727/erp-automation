import { Locator, Page, expect } from '@playwright/test';

/**
 * Page Object for a supplier's PRODUCT screens: Supplier -> Products tab -> a product (Hotel / Excursion / ...)
 * -> sub-tabs Products / Contract / Allotment / Promotions / Rate check.
 * Also the global Contracts list (menu "Contracts" -> /contracts).
 *
 * Notes:
 *  - the supplier LIST stays on screen beside the detail page, so table rows are filtered by their content.
 *  - date fields: click, type "16 Nov 2026", press Enter (fill() does not work). Changing "Valid to" also moves "Sell to".
 *  - contract dates that are not allowed (e.g. Valid to before Valid from) are silently refused by the field.
 */
export type SubTab = 'Products' | 'Contract' | 'Allotment' | 'Promotions' | 'Rate check';

export class ContractPage {
  readonly page: Page;
  // ----- contract editor -----
  readonly name: Locator;
  readonly code: Locator;
  readonly basePlan: Locator;
  readonly currency: Locator;
  readonly markets: Locator;
  readonly priority: Locator;
  readonly dates: Locator;           // 0 Valid from, 1 Valid to, 2 Sell from, 3 Sell to (+ season dates after)
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly problems: Locator;        // "2 problems to fix"
  readonly notSaved: Locator;        // "New contract, not saved yet."

  constructor(page: Page) {
    this.page = page;
    this.name = page.getByPlaceholder('Enter a contract name');
    this.code = page.getByPlaceholder('Enter a short code');
    this.basePlan = page.getByPlaceholder('Choose a base plan');
    this.currency = page.getByPlaceholder(/Choose a currency|Add a currency on the supplier/).first();
    this.markets = page.getByPlaceholder('All markets').first();
    this.priority = page.locator('main input[type=number]:visible').first();
    this.dates = page.getByPlaceholder('Choose a date');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true }).last();
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true }).last();
    this.problems = page.getByText(/\d+ problems? to fix/).last();
    this.notSaved = page.getByText(/not saved yet/).last();
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name, exact: typeof name === 'string' }).last();
  }

  subTab(name: SubTab): Locator {
    return this.page.getByRole('tab', { name, exact: true }).last();
  }

  /** The table on the current sub-tab (the supplier list on the left is the FIRST table, so take the last one) */
  get table(): Locator {
    return this.page.locator('main table:visible').last();
  }

  get rows(): Locator {
    return this.table.locator('tbody tr:visible');
  }

  get emptyMessage(): Locator {
    return this.page.getByText(/^There are no records in /).last();
  }

  /** Open supplier `id` -> Products -> `product` -> `sub` */
  async openProduct(id: number, product: string, sub: SubTab = 'Products') {
    await this.page.goto(`/suppliers/${id}/products`);
    await expect(this.page.getByRole('tab', { name: 'Products' }).first()).toBeVisible({ timeout: 90_000 });
    await expect(this.page.getByText('Choose a product type')).toBeVisible({ timeout: 60_000 });
    await this.page.getByRole('button', { name: product, exact: true }).last().click();
    await expect(this.subTab('Contract')).toBeVisible({ timeout: 60_000 });
    if (sub !== 'Products') {
      await this.subTab(sub).click();
      await expect(this.subTab(sub)).toHaveAttribute('aria-selected', 'true');
    }
    await this.page.waitForTimeout(1500);
  }

  async openAddContract(id: number, product: string) {
    await this.openProduct(id, product, 'Contract');
    await this.button('Add contract').click();
    await expect(this.name).toBeVisible({ timeout: 60_000 });
  }

  async pick(field: Locator, option: string | RegExp) {
    await field.click();
    await expect(this.page.getByRole('listbox').last()).toBeVisible();
    await this.page.waitForTimeout(500);   // the list animates open; an early click can land on the wrong option
    await this.page.getByRole('option', { name: option, exact: typeof option === 'string' }).first().click();
  }

  /** Type a date like "16 Nov 2026" into date field `i` */
  async setDate(i: number, value: string) {
    const f = this.dates.nth(i);
    await f.click();
    await this.page.keyboard.type(value, { delay: 20 });
    await this.page.keyboard.press('Enter');
    await this.page.keyboard.press('Escape');
  }

  async dateValues(): Promise<string[]> {
    return this.dates.evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
  }

  /** Add a season through the "Add season" popup (dates default to the contract dates) */
  async addSeason(name: string) {
    await this.button('Add season').click();
    const d = this.page.getByRole('dialog').last();
    await d.getByPlaceholder('Enter a season name').fill(name);
    await d.getByRole('button', { name: 'Add season' }).click();
    await expect(d).toBeHidden();
  }

  /** Price cell for "<Room> <Occupancy ...>, <Season>"  e.g. price('Club Single', 'QA Season') */
  price(roomAndOccupancy: string, season: string): Locator {
    return this.page.locator(`main input[aria-label^="${roomAndOccupancy}"][aria-label$=", ${season}"]:visible`).first();
  }

  async setPrice(roomAndOccupancy: string, season: string, value: string) {
    // like a user: click, select the old price, type the new one (fill() appends to a formatted price)
    const p = this.price(roomAndOccupancy, season);
    await p.click();
    await p.press('Control+A');
    await p.pressSequentially(value, { delay: 30 });
    await p.press('Tab');
  }
}

/** Global Contracts list (/contracts) */
export class ContractsListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly search: Locator;
  readonly rows: Locator;
  readonly bulkBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Contracts', exact: true }).first();
    this.search = page.getByPlaceholder('Contract, code or supplier');
    this.rows = page.locator('main tbody tr:visible');
    this.bulkBar = page.getByText(/\d+ selected/).last();
  }

  async open() {
    await this.page.goto('/contracts');
    await expect(this.heading).toBeVisible({ timeout: 90_000 });
    await expect(this.rows.first()).toBeVisible({ timeout: 60_000 });
  }

  /** The 4 filter drop-downs: 0 supplier, 1 status, 2 active, 3 ending */
  filter(i: number): Locator {
    return this.page.locator('main [role=combobox]:visible').nth(i);
  }

  /** Text of column n (1 = tick box, 2 = Contract, 3 = Supplier, 4 = Service, 5 = Valid, 6 = Status, 7 = Rates) */
  async column(n: number): Promise<string[]> {
    return (await this.rows.locator(`td:nth-child(${n})`).allInnerTexts()).map(s => s.trim());
  }
}
