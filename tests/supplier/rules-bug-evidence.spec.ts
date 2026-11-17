import { test, expect } from '../../fixtures';
import { Page, Locator } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage } from '../../pages/ContractPage';
import { ProductPage } from '../../pages/ProductPage';

/*
 * BUG EVIDENCE for the product owner's supplier rules (round 2) and the product screens - one screenshot per bug -> screenshots/bugs/
 * Only runs when asked:   $env:EVIDENCE='1'; npx playwright test --project=supplier rules-bug-evidence
 * SAFETY: every save is blocked. Screens with saved data show what supplier-rules2 / product-crud already saved (QA data only).
 */
async function shot(page: Page, file: string, ...targets: Locator[]) {
  for (const t of targets) await t.first().evaluate(el => { (el as HTMLElement).style.outline = '4px solid red'; (el as HTMLElement).style.outlineOffset = '2px'; }).catch(() => {});
  await page.waitForTimeout(500);
  const path = `screenshots/bugs/${file}.png`;
  await page.screenshot({ path });
  await test.info().attach(file, { path, contentType: 'image/png' });
}
const SUP = 18;

test.describe('Rules round 2 - bug evidence', () => {
  test.skip(process.env.EVIDENCE !== '1', 'set EVIDENCE=1 to run');
  test.setTimeout(240_000);
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

  test('BUG-56 Blocked supplier still offers "On Hold"', async ({ page }) => {
    await page.goto('/suppliers');
    await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('QA Auto Supplier');
    const row = page.locator('main tbody tr:visible', { hasText: 'Blocked' }).first();
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.locator('td').first().click();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await shot(page, 'BUG-56-blocked-supplier-offers-on-hold', page.getByRole('button', { name: 'On Hold', exact: true }), page.locator('main').getByText('Blocked').first());
  });

  test('BUG-57 Supplier city can be changed in Edit', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/overview`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const loc = page.locator('main :text-is("Location"):visible').first();
    await loc.scrollIntoViewIfNeeded();
    await loc.locator('xpath=ancestor::*[contains(@class,"MuiAccordionSummary") or @role="button"][1]').click().catch(() => loc.click());
    await page.waitForTimeout(1500);
    const city = page.getByPlaceholder('Search cities').first();
    await city.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, 'BUG-57-supplier-city-editable', city.locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
  });

  test('BUG-58 Payment due of 366 days is accepted', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/financials`);
    await page.getByRole('button', { name: /Add currency$/ }).last().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Select a currency').fill('USD');
    await page.getByRole('option', { name: /USD/ }).first().click();
    await d.getByPlaceholder('Number of days').fill('366');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await shot(page, 'BUG-58-payment-due-366-days-sent', d.getByPlaceholder('Number of days'));
  });

  test('BUG-59 IBAN "123" is accepted', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/financials`);
    await page.getByRole('button', { name: 'Add bank account' }).first().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Name on the account').fill('QA Auto Holder');
    await d.getByPlaceholder('Bank name').fill('QA Auto Bank');
    await d.getByPlaceholder('IBAN, or IFSC for an Indian bank').fill('123');
    await d.getByPlaceholder('8 or 11 characters').fill('ABCDAEAD');
    await d.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await shot(page, 'BUG-59-iban-not-validated', d.getByPlaceholder('IBAN, or IFSC for an Indian bank'));
  });

  test('BUG-60 Contact without email is accepted', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/contacts`);
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    const d = page.getByRole('dialog').last();
    await d.getByPlaceholder('Full name').fill('QA Auto Contact no email');
    await d.getByPlaceholder('Reservations, Sales, Accounts…').click();
    await page.getByRole('option').first().click();
    await d.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await shot(page, 'BUG-60-contact-without-email-sent', d.getByPlaceholder('name@company.com'));
  });

  test('BUG-61 Supplier list has no city search', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page.locator('main tbody tr:visible').first()).toBeVisible({ timeout: 90_000 });
    await shot(page, 'BUG-61-supplier-list-no-city-search', page.locator('main thead').first());
  });

  test('BUG-62 Sell to after Valid to is accepted', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill('QA Auto Contract sell dates');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    const end = new Date((await c.dateValues())[1]); end.setDate(end.getDate() + 20);
    await c.setDate(3, end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace('Sept', 'Sep'));
    await c.saveButton.click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await shot(page, 'BUG-62-contract-sell-to-after-valid-to', c.dates.nth(1), c.dates.nth(3));
  });

  test('BUG-63 Contract warns "No allotment holds ... on request"', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.addSeason('QA Season');
    await c.setPrice('Club Single', 'QA Season', '300');
    const warn = page.getByText(/No allotment holds/).first();
    await expect(warn).toBeVisible();
    await warn.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-63-contract-allotment-first-warning', warn);
  });

  test('BUG-64 Cancellation charge of 150% is accepted', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill('QA Auto Contract 150pct');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.button('Add cancellation policy').click();
    const v = page.locator('main input[type=number]:visible').last();
    await v.click(); await v.press('Control+A'); await v.pressSequentially('150'); await v.press('Tab');
    await c.saveButton.click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await v.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-64-cancellation-150-percent', v);
  });

  test('BUG-65 Two contracts with the same name were saved', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const same = c.rows.filter({ hasText: / same name/ });
    await expect(same.nth(1)).toBeVisible();
    await shot(page, 'BUG-65-contract-same-name-saved', same.nth(0).locator('td').first(), same.nth(1).locator('td').first());
  });

  test('BUG-66 Allotment saved for a product without a contract', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openProduct(SUP, 'Excursion', 'Allotment');
    const row = c.rows.filter({ hasText: /no contract/ }).first();
    await expect(row).toBeVisible();
    await shot(page, 'BUG-66-allotment-without-contract-saved', row);
  });

  test('BUG-67 Promotion with 100% discount was saved', async ({ page }) => {
    const c = new ContractPage(page);
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    const row = c.rows.filter({ hasText: /100pct/ }).first();
    await expect(row).toBeVisible();
    await shot(page, 'BUG-67-promotion-100-percent-saved', row);
  });

  test('BUG-68 Two rooms with the same name were saved', async ({ page }) => {
    const p = new ProductPage(page);
    await p.open(SUP, 'Hotel');
    const chips = page.locator('main button:visible', { hasText: /^QA Auto Room \w+ edited$/ });
    const names = await chips.allInnerTexts();
    const dup = names.find((n, i) => names.indexOf(n) !== i)!;
    const both = page.locator('main button:visible', { hasText: new RegExp(`^${dup}$`) });
    await shot(page, 'BUG-68-room-same-name-saved', both.nth(0), both.nth(1));
  });
  const pdf = (n: number) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(n, 32), Buffer.from('\n%%EOF\n')]);
  const docsEdit = async (page: Page) => {
    await page.goto(`/suppliers/${SUP}/overview`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await expect(page.locator('main input[type=file]').first()).toBeAttached({ timeout: 60_000 });
  };
  test('BUG-78 Supplier document above 5 MB gets no message', async ({ page }) => {
    await docsEdit(page);
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto-6mb.pdf', mimeType: 'application/pdf', buffer: pdf(6 * 1024 * 1024) });
    await page.waitForTimeout(3000);
    const slot = page.locator('main').getByText('Fire safety certificate', { exact: true }).first().locator('xpath=ancestor::div[2]');
    await slot.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-78-document-over-5mb-no-message', slot);
  });
  test('BUG-79 Supplier document slot takes a .txt file', async ({ page }) => {
    await docsEdit(page);
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto.txt', mimeType: 'text/plain', buffer: Buffer.from('not a document') });
    await page.waitForTimeout(3000);
    const shown = page.getByText('qa-auto.txt').first();
    await shown.scrollIntoViewIfNeeded();
    await shot(page, 'BUG-79-document-txt-accepted', shown);
  });
  test('BUG-80 Supplier names are saved with spaces around them', async ({ page }) => {
    await page.goto('/suppliers');
    await expect(page.locator('main tbody tr:visible').first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole('columnheader', { name: /^Name/ }).locator('span, div').filter({ hasText: /^Name$/ }).first().click();
    await page.waitForTimeout(2500);
    const cells = page.locator('main tbody tr:visible td:first-child');
    const n = await cells.count();
    const marks = [];
    for (let i = 0; i < n; i++) { const t = await cells.nth(i).evaluate(el => el.textContent ?? ''); if (t !== t.trim()) marks.push(cells.nth(i)); }
    await shot(page, 'BUG-80-supplier-names-not-trimmed', ...marks);
  });
});
