// Helper (not a test): READ-ONLY screenshots for the Supplier-module questions to the product owner.
// Every POST/PUT/DELETE/PATCH is blocked. Output: reports/Supplier-Questions/screenshots/Q-NN-*.png
// Run:  node scripts/capture-supplier-questions.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = 'reports/Supplier-Questions/screenshots';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) return r.abort();
  return r.continue();
});
const page = await ctx.newPage();
const btn = name => page.getByRole('button', { name, exact: true }).last();
const red = async loc => { try { await loc.first().evaluate(el => { el.style.outline = '4px solid red'; el.style.outlineOffset = '2px'; }, null, { timeout: 8000 }); } catch {} };
const ONLY = process.argv.slice(2);
const shot = async (id, label, fn, ...marks) => {
  if (ONLY.length && !ONLY.includes(id)) return;
  try {
    await fn();
    await page.waitForTimeout(1500);
    for (const m of marks) await red(typeof m === 'function' ? m() : m);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${id}-${label}.png` });
    console.log('ok', id, label);
  } catch (e) { console.log('FAILED', id, label, String(e).slice(0, 160)); }
  await page.keyboard.press('Escape').catch(() => {});
};
const supplier = async (id, tab = 'overview') => {
  await page.goto(`/suppliers/${id}/${tab}`);
  await page.getByRole('tab', { name: 'Overview' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(3000);
};
const product = async (id, sub) => {
  await supplier(id, 'products');
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
  await page.waitForTimeout(3500);
  if (sub) { await page.getByRole('tab', { name: sub, exact: true }).last().click(); await page.waitForTimeout(3500); }
};
const fieldBox = ph => page.getByPlaceholder(ph).first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]');

// ---------- supplier ----------
await shot('Q-01', 'supplier-status', async () => { await supplier(18); await page.getByRole('button', { name: 'Edit', exact: true }).first().click(); }, () => page.getByRole('button', { name: 'Blocked', exact: true }).locator('xpath=..'));
await shot('Q-02', 'supplier-code', async () => { await page.goto('/suppliers'); await page.getByRole('button', { name: 'Add supplier' }).waitFor({ timeout: 90_000 }); await page.getByRole('button', { name: 'Add supplier' }).click(); await page.waitForTimeout(3000); }, () => fieldBox('Assigned when saved'));
await shot('Q-03', 'supplier-no-delete', async () => { await supplier(18); }, () => page.locator('main').getByText('On hold').first());
await shot('Q-04', 'contact-roles', async () => { await supplier(18, 'contacts'); await page.getByRole('button', { name: /Add contact$/ }).last().click(); await page.waitForTimeout(1500); await page.getByPlaceholder('Reservations, Sales, Accounts…').click(); }, () => page.getByRole('listbox'));
await shot('Q-05', 'primary-contact', async () => { await supplier(18, 'contacts'); }, () => page.locator('main :visible').getByText(/^Primary$/i));
await shot('Q-06', 'currency-removed-but-used', async () => { await product(10, 'Contract'); await page.locator('main table:visible').last().locator('tbody tr').first().locator('td').first().click(); await page.waitForTimeout(4000); }, () => fieldBox(/Add a currency on the supplier/));
await shot('Q-07', 'payment-terms', async () => { await supplier(18, 'financials'); }, () => page.locator('main table:visible').last());
await shot('Q-08', 'bank-account', async () => { await supplier(18, 'financials'); await page.getByRole('button', { name: 'Add bank account' }).first().click(); await page.waitForTimeout(1500); }, () => page.getByRole('dialog').last());
await shot('Q-09', 'tax-fields', async () => { await supplier(18, 'financials'); await page.getByText(/PAN/).first().scrollIntoViewIfNeeded(); }, () => page.getByText(/PAN/).first().locator('xpath=ancestor::div[3]'));
await shot('Q-10', 'documents-portal', async () => { await supplier(18); }, () => page.getByText(/\d+ of \d+ uploaded/).first().locator('xpath=ancestor::div[2]'), () => page.getByText('Supplier portal').first().locator('xpath=ancestor::div[2]'));
await shot('Q-11', 'products-offered', async () => { await supplier(18, 'products'); await page.getByRole('button', { name: 'Edit products offered' }).click(); await page.waitForTimeout(1500); }, () => page.getByRole('dialog').last());
await shot('Q-12', 'content-sections', async () => { await supplier(18, 'content'); }, () => page.locator('main :text-is("Images"):visible').first());

// ---------- contract ----------
await shot('Q-13', 'contract-approve', async () => { await product(18, 'Contract'); }, () => page.getByRole('button', { name: /^Approve / }).first());
await shot('Q-14', 'approved-back-to-draft', async () => { await product(10, 'Contract'); await page.locator('main table:visible').last().locator('tbody tr').first().locator('td').first().click(); await page.waitForTimeout(4000); await btn('Save').click(); await page.waitForTimeout(1000); }, () => page.getByRole('dialog').last());
await shot('Q-15', 'contract-dates', async () => { await product(18, 'Contract'); await btn('Add contract').click(); await page.waitForTimeout(3000); }, () => page.getByPlaceholder('Choose a date').nth(2).locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'), () => page.getByPlaceholder('Choose a date').nth(3).locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await shot('Q-16', 'contract-priority', async () => { await product(18, 'Contract'); await btn('Add contract').click(); await page.waitForTimeout(3000); }, () => page.locator('main input[type=number]:visible').first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await shot('Q-17', 'contract-code', async () => { await product(18, 'Contract'); await btn('Add contract').click(); await page.waitForTimeout(3000); }, () => fieldBox('Enter a short code'));
await shot('Q-18', 'missing-prices', async () => {
  await product(18, 'Contract'); await btn('Add contract').click(); await page.waitForTimeout(3000);
  await page.getByPlaceholder('Choose a base plan').click(); await page.getByRole('option', { name: 'Bed and breakfast' }).click();
  await btn('Add season').click(); const d = page.getByRole('dialog').last(); await d.getByPlaceholder('Enter a season name').fill('Peak'); await d.getByRole('button', { name: 'Add season' }).click();
  await page.waitForTimeout(1500); const p = page.locator('main input[aria-label^="Club Single"]:visible').first(); await p.click(); await p.pressSequentially('100'); await p.press('Tab'); await page.waitForTimeout(1000); await page.getByText(/prices are missing/).first().scrollIntoViewIfNeeded();
}, () => page.getByText(/prices are missing/).first(), () => page.getByText(/No allotment holds/).first());
await shot('Q-19', 'child-policy', async () => { await product(10, 'Contract'); await page.locator('main table:visible').last().locator('tbody tr').first().locator('td').first().click(); await page.waitForTimeout(4000); await page.locator('main :text-is("Child policy"):visible').first().scrollIntoViewIfNeeded(); }, () => page.locator('main :text-is("Child policy"):visible').first().locator('xpath=ancestor::div[2]'));
await shot('Q-20', 'cancellation-policy', async () => { await product(10, 'Contract'); await page.locator('main table:visible').last().locator('tbody tr').first().locator('td').first().click(); await page.waitForTimeout(4000); await page.getByText('Cancellation policy').first().scrollIntoViewIfNeeded(); }, () => page.getByText('Cancellation policy').first().locator('xpath=ancestor::div[2]'));
await shot('Q-21', 'allotment-form', async () => { await product(18, 'Allotment'); await btn('Add allotment').click(); await page.waitForTimeout(2500); await btn('Add block').click(); }, () => page.getByText('Release', { exact: true }).last().locator('xpath=ancestor::div[2]'), () => page.locator('main table:visible').last());
await shot('Q-22', 'promotion-form', async () => { await product(18, 'Promotions'); await btn('Add promotion').click(); await page.waitForTimeout(2500); }, () => page.getByText('Combinable').first().locator('xpath=ancestor::div[2]'), () => page.getByText('Booking window & stay rules').first().locator('xpath=ancestor::div[2]'));
await shot('Q-23', 'import-excel', async () => { await product(18, 'Contract'); await page.getByText('Import from Excel').last().click(); }, () => page.getByRole('dialog').last());
await shot('Q-24', 'rate-check', async () => { await product(10, 'Rate check'); }, () => page.getByText('Stay to price').first().locator('xpath=ancestor::div[2]'));
await shot('Q-25', 'bulk-actions', async () => { await page.goto('/contracts'); await page.getByRole('heading', { name: 'Contracts' }).first().waitFor({ timeout: 90_000 }); await page.waitForTimeout(4000); await page.locator('main tbody tr:visible').first().getByRole('checkbox').check(); }, () => page.getByText(/\d+ selected/).last().locator('xpath=..'));
await shot('Q-26', 'active-vs-status', async () => { await product(10, 'Contract'); }, () => page.locator('main table:visible').last().locator('tbody tr').first());
await browser.close();
