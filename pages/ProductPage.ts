import { Locator, Page, expect } from '@playwright/test';

/**
 * Page Object for a supplier's products: Supplier -> Products tab -> Hotel / Excursion / Private transfer -> "Products" sub-tab.
 *  - Hotel: rooms ("Add room", one chip per room), form with Room Name, View, Charged per, B2B/B2C, occupancy table, age policy.
 *  - Excursion / Private transfer: "Add excursion" / "Add private transfer", Product name, Service on / by, Max capacity, pax bands.
 * An existing product opens READ-ONLY with Duplicate / History / Edit; Edit turns on "Save changes".
 */
export class ProductPage {
  readonly page: Page;
  readonly create: Locator;
  readonly saveChanges: Locator;
  readonly cancel: Locator;
  readonly edit: Locator;
  readonly duplicate: Locator;
  readonly history: Locator;
  readonly roomName: Locator;
  readonly productName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.create = page.locator('main button:visible', { hasText: /^Create product$/ });
    this.saveChanges = page.locator('main button:visible', { hasText: /^Save changes$/ });
    this.cancel = page.locator('main button:visible', { hasText: /^Cancel$/ }).last();
    this.edit = page.locator('main button:visible').filter({ hasText: /^Edit$/ }).or(page.locator('main button[aria-label="Edit"]:visible, main button[title="Edit"]:visible')).last();
    this.duplicate = page.locator('main button:visible').filter({ hasText: /^Duplicate$/ }).or(page.locator('main button[aria-label="Duplicate"]:visible, main button[title="Duplicate"]:visible')).last();
    this.history = page.locator('main button:visible').filter({ hasText: /^History$/ }).or(page.locator('main button[aria-label="History"]:visible, main button[title="History"]:visible')).last();
    this.roomName = page.getByPlaceholder('Room Name');
    this.productName = page.getByPlaceholder('Enter a product name');
  }

  /** Supplier `id` -> Products -> `product` (stays on the "Products" sub-tab) */
  async open(id: number, product: string) {
    for (let i = 0; i < 3; i++) { try { await this.page.goto(`/suppliers/${id}/products`); break; } catch { await this.page.waitForTimeout(1500); } }
    await expect(this.page.getByText('Choose a product type')).toBeVisible({ timeout: 90_000 });
    await this.page.getByRole('button', { name: product, exact: true }).last().click();
    await expect(this.page.getByRole('tab', { name: 'Contract', exact: true }).last()).toBeVisible({ timeout: 60_000 });
    await this.page.waitForTimeout(1500);
  }

  addButton(label: string): Locator { return this.page.locator('main button:visible', { hasText: new RegExp(`^${label}$`) }).first(); }
  /** the chip / card of an existing product (rooms show the room name; excursions "name + city") */
  item(name: string): Locator { return this.page.locator('main button:visible', { hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).first(); }
  filter(which: 'All' | 'Active' | 'Inactive'): Locator { return this.page.locator('main button:visible', { hasText: new RegExp(`^${which}\\s*\\d+`) }).first(); }
  async count(which: 'All' | 'Active' | 'Inactive'): Promise<number> { return Number(((await this.filter(which).innerText()).match(/\d+/) ?? ['0'])[0]); }

  spin(name: string): Locator { return this.page.locator(`main input[aria-label="${name}"]:visible`).first(); }
  /** a switch / checkbox by its label, e.g. "Sell to agents (B2B)" */
  toggle(name: string): Locator { return this.page.locator(`main input[aria-label="${name}"]`).first(); }
  iconButton(label: string): Locator { return this.page.locator(`main button[aria-label="${label}"]:visible, main button[title="${label}"]:visible`).first(); }
  select(i: number): Locator { return this.page.getByPlaceholder('Select', { exact: true }).nth(i); }
  byValue(v: string): Locator { return this.page.locator(`main input[value="${v}"]`).first(); }
  occupancyRows(): Locator { return this.page.locator('main input[aria-label="adults"]:visible'); }
  /** "Add room" under the occupancy table (the first "Add room" on the page starts a new room) */
  addOccupancy(): Locator { return this.page.getByRole('button', { name: 'Add room', exact: true }).nth(1); }
  /** the "some fields need attention" summary and field errors */
  errors(): Locator { return this.page.locator('main [role=alert]:visible, main .Mui-error:visible').filter({ hasText: /\w/ }); }

  async pick(field: Locator, option: string | RegExp) {
    await field.click();
    await expect(this.page.getByRole('listbox').last()).toBeVisible();
    await this.page.waitForTimeout(400);
    await this.page.getByRole('option', { name: option, exact: typeof option === 'string' }).first().click();
  }

  async typeNumber(f: Locator, v: string) {
    await f.click(); await f.press('Control+A'); await f.pressSequentially(v); await f.press('Tab');
  }
}
