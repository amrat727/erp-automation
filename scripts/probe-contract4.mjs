// Helper (not a test): READ-ONLY dry run of the "Add contract" flow - every save is blocked and the request body is recorded.
// Run:  node scripts/probe-contract4.mjs <outDir> [supplierId] [product]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract4';
const ID = process.argv[3] ?? '18';
const PRODUCT = process.argv[4] ?? 'Hotel';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ at: out.steps.length, req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 3000) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const vis = async () => ({
  problems: await page.getByText(/problems? to fix/).last().innerText().catch(() => ''),
  errorFields: await page.locator('main .Mui-error:visible').evaluateAll(els => els.map(e => e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText || e.innerText).map(s => s.trim()).filter(Boolean)),
  helper: (await page.locator('main .MuiFormHelperText-root:visible, [role=tooltip]:visible, [role=alert]:visible').allInnerTexts()).map(clean).filter(Boolean),
  options: (await page.getByRole('option').allInnerTexts().catch(() => [])).map(clean),
  dialogs: (await page.getByRole('dialog').allInnerTexts().catch(() => [])).map(s => clean(s).slice(0, 1500)),
  dates: await page.getByPlaceholder('Choose a date').evaluateAll(els => els.map(e => e.value)),
  seasonInputs: await page.locator('main input:visible').evaluateAll(els => els.slice(14, 60).map(e => [e.getAttribute('aria-label') || '', e.placeholder, e.value].join('|'))),
});
const snap = async label => {
  await page.waitForTimeout(1500);
  out.steps.push({ label, ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png` });
  console.log('step', n, label);
};
const tryStep = async (label, fn) => { try { await fn(); await snap(label); } catch (e) { out.steps.push({ label, error: String(e).slice(0, 300) }); console.log('FAILED', label, String(e).slice(0, 150)); } };
const btn = name => page.getByRole('button', { name, exact: true }).last();

try {
  await page.goto(`/suppliers/${ID}/products`);
  await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: PRODUCT, exact: true }).last().click();
  await page.waitForTimeout(4000);
  await page.getByRole('tab', { name: 'Contract', exact: true }).last().click();
  await page.waitForTimeout(3000);
  await btn('Add contract').click();
  await page.waitForTimeout(4000);

  await tryStep('name + base plan, no currency, save', async () => {
    await page.getByPlaceholder('Enter a contract name').fill('QA Probe Contract');
    await page.getByPlaceholder('Choose a base plan').click();
    await page.getByRole('option', { name: 'Bed and breakfast' }).click();
    await page.waitForTimeout(1500);
    await btn('Save').click();
    await page.waitForTimeout(3000);
  });
  await tryStep('currency options', async () => { await page.getByPlaceholder('Choose a currency').click(); });
  await tryStep('currency pick first', async () => { await page.getByRole('option').first().click(); });
  // ---- date typing experiments on "Valid to"
  const validTo = page.getByPlaceholder('Choose a date').nth(1);
  await tryStep('date: fill', async () => { await validTo.click(); await validTo.fill('01 Jan 2026'); await validTo.press('Tab'); });
  await tryStep('date: select-all + type', async () => { await validTo.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('01 Jan 2026', { delay: 50 }); await page.keyboard.press('Tab'); });
  await tryStep('date: calendar button', async () => { await page.getByRole('button', { name: 'Open calendar' }).nth(1).click(); await page.waitForTimeout(1000); });
  await page.keyboard.press('Escape');
  await tryStep('save with valid-to before valid-from', async () => { await btn('Save').click(); await page.waitForTimeout(3000); });
  await page.keyboard.press('Escape');
  // ---- season + price
  await tryStep('add season', async () => { await btn('Add season').click(); await page.waitForTimeout(1500); });
  await tryStep('season name + price', async () => {
    await page.getByPlaceholder('Enter a season name').first().fill('QA Season');
    const price = page.locator('main input[placeholder="–"]:visible').first();
    await price.fill('500');
    await price.press('Tab');
  });
  await tryStep('add cancellation band', async () => { await btn('Add cancellation policy').click(); await page.waitForTimeout(1000); });
  await tryStep('final save', async () => { await btn('Save').click(); await page.waitForTimeout(4000); });
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
