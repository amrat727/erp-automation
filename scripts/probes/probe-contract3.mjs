// Helper (not a test): READ-ONLY map of the Add forms (contract / allotment / promotion / import) on one supplier product.
// Every POST/PUT/DELETE/PATCH is blocked (only login refresh goes through).
// Run:  node scripts/probes/probe-contract3.mjs <outDir> [supplierId] [product]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract3';
const ID = process.argv[3] ?? '18';
const PRODUCT = process.argv[4] ?? 'Hotel';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 600)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const vis = async () => ({
  buttons: (await page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '?') + (e.disabled ? ' [disabled]' : '')))).map(clean).filter(b => !/^(Share|Open|Open calendar)$/.test(b)),
  inputs: await page.locator('main input:visible, main textarea:visible, [role=dialog] input:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, e.disabled ? 'disabled' : 'EDITABLE', e.maxLength > 0 ? 'max' + e.maxLength : '', (e.value || '').slice(0, 40)].filter(Boolean).join(' | '))),
  options: (await page.getByRole('option').allInnerTexts().catch(() => [])).map(clean),
  errors: (await page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts().catch(() => [])).map(clean).filter(Boolean),
  dialogs: (await page.getByRole('dialog').allInnerTexts().catch(() => [])).map(s => clean(s).slice(0, 2500)),
  text: (() => 0)(),
  bodyText: clean(await page.locator('main').innerText()).replace(/^.*?Rate check/, '').slice(0, 3500),
});
const snap = async label => {
  await page.waitForTimeout(2000);
  out.steps.push({ label, url: page.url().replace('https://erp.nexgenpilot.com', ''), ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png` });
  console.log('step', n, label);
};
const tryStep = async (label, fn) => { try { await fn(); await snap(label); } catch (e) { out.steps.push({ label, error: String(e).slice(0, 300) }); console.log('FAILED', label, String(e).slice(0, 150)); } };
const sub = name => page.getByRole('tab', { name, exact: true }).last();
const btn = name => page.getByRole('button', { name, exact: true }).last();
const toSub = async t => {
  await page.goto(`/suppliers/${ID}/products`);
  await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: PRODUCT, exact: true }).last().click();
  await page.waitForTimeout(4000);
  await sub(t).click();
  await page.waitForTimeout(4000);
};

try {
  // ---- Contract list on this product
  await toSub('Contract');
  await snap('contract list');
  await tryStep('import from excel', async () => { await page.getByText('Import from Excel').last().click(); await page.waitForTimeout(2500); });
  await page.keyboard.press('Escape');

  // ---- Add contract: empty save, then base plan options, then pick one
  await toSub('Contract');
  await btn('Add contract').click();
  await page.waitForTimeout(4000);
  await tryStep('add contract empty save', async () => { await btn('Save').click(); await page.waitForTimeout(2000); });
  await tryStep('problems link', async () => { await page.getByText(/problems? to fix/).last().click(); await page.waitForTimeout(1500); });
  await page.keyboard.press('Escape');
  await tryStep('rate for options', async () => { await page.locator('main input:visible').nth(2 + 4).click().catch(() => {}); await page.getByText('Both', { exact: true }).last().click(); });
  await page.keyboard.press('Escape');
  await tryStep('base plan options', async () => { await page.getByPlaceholder('Choose a base plan').click(); });
  await tryStep('base plan pick first', async () => { await page.getByRole('option').first().click(); await page.waitForTimeout(3000); });
  await tryStep('currency options', async () => { await page.getByPlaceholder(/Add a currency on the supplier/).click(); });
  await page.keyboard.press('Escape');
  await tryStep('markets options', async () => { await page.getByPlaceholder('All markets').first().click(); });
  await page.keyboard.press('Escape');
  await tryStep('valid to before valid from', async () => {
    const d = page.getByPlaceholder('Choose a date');
    await d.nth(1).fill('01 Jan 2026');
    await d.nth(1).press('Tab');
    await btn('Save').click();
    await page.waitForTimeout(2000);
  });
  await tryStep('add contract cancel', async () => { await btn('Cancel').click(); await page.waitForTimeout(2500); });

  // ---- Allotment add
  await toSub('Allotment');
  await snap('allotment list');
  await tryStep('add allotment form', async () => { await btn('Add allotment').click(); await page.waitForTimeout(3500); });
  await tryStep('add allotment empty save', async () => { await page.getByRole('button', { name: /^(Save|Create|Add)/ }).last().click(); await page.waitForTimeout(2000); });
  await page.keyboard.press('Escape');

  // ---- Promotion add
  await toSub('Promotions');
  await snap('promotions list');
  await tryStep('add promotion form', async () => { await btn('Add promotion').click(); await page.waitForTimeout(3500); });
  await tryStep('add promotion empty save', async () => { await page.getByRole('button', { name: /^(Save|Create|Add)/ }).last().click(); await page.waitForTimeout(2000); });
  await page.keyboard.press('Escape');

  // ---- Rate check empty
  await toSub('Rate check');
  await tryStep('rate check empty', async () => { await btn('Check rate').click(); await page.waitForTimeout(3000); });
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
