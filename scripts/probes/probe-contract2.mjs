// Helper (not a test): READ-ONLY map of the supplier product Contract screens + the Contracts list.
// Every POST/PUT/DELETE/PATCH is blocked (only login refresh goes through).
// Run:  node scripts/probes/probe-contract2.mjs <outDir> [supplierId] [product]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract2';
const ID = process.argv[3] ?? '10';
const PRODUCT = process.argv[4] ?? 'Hotel';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 400)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const vis = async () => ({
  sections: (await page.locator('main :visible').getByText(/./).evaluateAll(els => els.filter(e => /^(H\d|LEGEND)$/.test(e.tagName) || getComputedStyle(e).fontWeight >= 600 && e.children.length === 0).map(e => e.innerText.trim()).filter(t => t && t.length < 60))).filter((v, i, a) => a.indexOf(v) === i).slice(0, 120),
  tabs: (await page.locator('main [role=tab]:visible').allInnerTexts()).map(clean),
  buttons: (await page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || e.getAttribute('title') || '?') + (e.disabled ? ' [disabled]' : '')))).map(clean),
  inputs: await page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => {
    const lbl = e.closest('.MuiFormControl-root, label, div')?.parentElement?.querySelector('label')?.innerText || e.getAttribute('aria-label') || '';
    return [lbl.replace(/\s+/g, ' ').slice(0, 30), e.type, e.placeholder, e.disabled ? 'disabled' : e.readOnly ? 'readonly' : 'EDITABLE', e.maxLength > 0 ? 'max' + e.maxLength : '', e.min ? 'min' + e.min : '', (e.value || '').slice(0, 40)].filter(Boolean).join(' | ');
  })),
  headers: (await page.locator('main th:visible').allInnerTexts()).map(clean),
  rows: (await page.locator('main tbody tr:visible').allInnerTexts()).map(s => clean(s).slice(0, 220)),
  dialogs: (await page.getByRole('dialog').allInnerTexts().catch(() => [])).map(s => clean(s).slice(0, 1500)),
  alerts: (await page.locator('[role=alert]:visible, .MuiAlert-root:visible, .Mui-error:visible, .MuiFormHelperText-root:visible').allInnerTexts().catch(() => [])).map(clean).filter(Boolean),
  bodyText: clean(await page.locator('main').innerText()).slice(0, 6000),
});
const snap = async label => {
  await page.waitForTimeout(2000);
  out.steps.push({ label, url: page.url().replace('https://erp.nexgenpilot.com', ''), ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label, page.url());
};
const tryStep = async (label, fn) => { try { await fn(); await snap(label); } catch (e) { out.steps.push({ label, error: String(e).slice(0, 300) }); console.log('FAILED', label, String(e).slice(0, 150)); } };
const sub = name => page.getByRole('tab', { name, exact: true }).last();
const toProduct = async () => {
  await page.goto(`/suppliers/${ID}/products`);
  await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: PRODUCT, exact: true }).last().click();
  await page.waitForTimeout(4000);
};

try {
  await toProduct();
  // ---- Contract list inside the product
  await tryStep('contract list', async () => { await sub('Contract').click(); await page.waitForTimeout(4000); });
  await tryStep('contract list columns', async () => { await page.getByRole('button', { name: 'Columns' }).last().click(); });
  await page.keyboard.press('Escape');
  await tryStep('contract validity filter', async () => { await page.locator('main [role=combobox]:visible').first().click(); });
  await page.keyboard.press('Escape');
  await tryStep('contract status filter', async () => { await page.locator('main [role=combobox]:visible').nth(1).click(); });
  await page.keyboard.press('Escape');
  // ---- open the existing contract, full page
  await tryStep('contract editor', async () => { await page.locator('main tbody tr:visible').filter({ hasText: /\d+ rates?/ }).first().locator('td').first().click(); await page.waitForTimeout(6000); });
  // try the rows view of rates
  await tryStep('rates rows view', async () => { await page.getByRole('button', { name: /Rows/ }).or(page.getByText('Rows', { exact: true })).last().click(); await page.waitForTimeout(3000); });
  await tryStep('warning icon', async () => { await page.locator('main [data-testid=WarningAmberIcon]:visible, main svg[data-testid*=Warning]:visible').first().click(); await page.waitForTimeout(1500); });
  await page.keyboard.press('Escape');
  // ---- Validation on the existing contract: clear the name and Save (blocked anyway)
  await tryStep('editor clear name + save', async () => {
    const nm = page.locator('main input:visible').first();
    await nm.fill('');
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await page.waitForTimeout(2500);
  });
  await tryStep('editor cancel', async () => { await page.getByRole('button', { name: 'Cancel', exact: true }).last().click(); await page.waitForTimeout(3000); });
  await page.keyboard.press('Escape');

  // ---- Add contract
  await toProduct();
  await sub('Contract').click();
  await page.waitForTimeout(4000);
  await tryStep('add contract form', async () => { await page.getByRole('button', { name: 'Add contract' }).last().click(); await page.waitForTimeout(5000); });
  await tryStep('add contract save empty', async () => { await page.getByRole('button', { name: /^(Save|Create|Create contract)$/ }).last().click(); await page.waitForTimeout(3000); });
  await page.keyboard.press('Escape');
  await tryStep('import from excel', async () => { await toProduct(); await sub('Contract').click(); await page.waitForTimeout(3000); await page.getByRole('button', { name: 'Import from Excel' }).last().click(); await page.waitForTimeout(3000); });
  await page.keyboard.press('Escape');

  // ---- other product sub-tabs
  for (const t of ['Allotment', 'Promotions', 'Rate check']) {
    await toProduct();
    await tryStep(`sub ${t}`, async () => { await sub(t).click(); await page.waitForTimeout(5000); });
  }

  // ---- global Contracts list
  await page.goto('/contracts');
  await page.getByRole('heading', { name: 'Contracts' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(5000);
  await snap('contracts list');
  await tryStep('contracts tick one', async () => { await page.locator('main tbody tr:visible').first().getByRole('checkbox').check(); await page.waitForTimeout(1500); });
  await tryStep('contracts status filter', async () => { await page.locator('main [role=combobox]:visible').nth(1).click(); });
  await page.keyboard.press('Escape');
  await tryStep('contracts active filter', async () => { await page.locator('main [role=combobox]:visible').nth(2).click(); });
  await page.keyboard.press('Escape');
  await tryStep('contracts ending filter', async () => { await page.locator('main [role=combobox]:visible').nth(3).click(); });
  await page.keyboard.press('Escape');
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();

