// Helper (not a test): READ-ONLY look at Supplier edit modes (all saves blocked, nothing is changed).
// Run:  node scripts/probe-supplier-edit.mjs <outDir> [supplierId]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'supplier-edit';
const ID = process.argv[3] ?? '18';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !r.request().url().includes('negotiate')) { sent.push(`${m} ${r.request().url()} ${r.request().postData()?.slice(0, 1500) ?? ''}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
let n = 0;
const vis = async () => ({
  buttons: (await page.getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
  inputs: await page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => [e.type, e.placeholder, e.getAttribute('role'), e.disabled ? 'disabled' : 'EDITABLE', e.maxLength > 0 ? 'max' + e.maxLength : '', (e.value || '').slice(0, 30)].filter(Boolean).join(' | '))),
  toasts: await page.locator('[role=alert]:visible, .Toastify__toast:visible').allInnerTexts().catch(() => []),
});
const snap = async label => {
  await page.waitForTimeout(2500);
  out.steps.push({ label, url: new URL(page.url()).pathname, ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label);
};

try {
  await page.goto(`/suppliers/${ID}/overview`);
  await page.getByRole('tab', { name: 'Overview' }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(5000);
  await snap('overview');
  // Edit on the overview
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await snap('overview edit mode');
  // try saving unchanged (blocked) to see what it sends
  const save = page.getByRole('button', { name: /^(Save|Save changes|Update)$/ }).first();
  if (await save.count()) { await save.click(); await snap('overview save (blocked)'); }
  const cancel = page.getByRole('button', { name: /^(Cancel|Discard)$/ }).first();
  if (await cancel.count()) await cancel.click().catch(() => {});

  // Products tab: Edit products offered
  await page.getByRole('tab', { name: 'Products' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Edit products offered' }).click().catch(() => {});
  await snap('products edit');
  await page.keyboard.press('Escape');

  // Financials tab: Edit (tax and documents)
  await page.getByRole('tab', { name: 'Financials' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click().catch(() => {});
  await snap('financials edit');
  for (const cb of await page.locator('main [role=combobox]:visible').all()) {
    await cb.click().catch(() => {});
    await page.waitForTimeout(1200);
    out.steps.push({ label: 'combo ' + (await cb.getAttribute('placeholder')), options: await page.getByRole('option').allInnerTexts() });
    await page.keyboard.press('Escape');
  }
  // contacts tab: Add contact role options
  await page.getByRole('tab', { name: 'Contacts' }).click();
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('dialog').last().locator('[role=combobox]').first().click();
  await page.waitForTimeout(1500);
  out.steps.push({ label: 'contact roles', options: await page.getByRole('option').allInnerTexts() });
  await page.keyboard.press('Escape');

  // Add supplier page: dropdown options
  await page.goto('/suppliers/new');
  await page.waitForTimeout(8000);
  for (const ph of ['Days after invoice', 'Percentage']) {
    const cb = page.locator(`main input[placeholder="${ph}"]:visible, main [role=combobox]:visible`).filter({ hasText: '' });
    await page.locator('main input:visible').filter({ has: page.locator('xpath=.') }).first().waitFor().catch(() => {});
  }
  for (const cb of await page.locator('main [role=combobox]:visible').all()) {
    const ph = (await cb.getAttribute('placeholder')) || (await cb.inputValue().catch(() => '')) || '?';
    await cb.click().catch(() => {});
    await page.waitForTimeout(1500);
    out.steps.push({ label: 'add combo ' + ph, options: (await page.getByRole('option').allInnerTexts()).slice(0, 40) });
    await page.keyboard.press('Escape');
  }
  await snap('add page');
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
