// Helper (not a test): READ-ONLY - Allotment and Promotion forms in detail (labels, required fields, what a filled form sends). Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract7';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 2500)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const btn = name => page.getByRole('button', { name, exact: true }).last();
const inputs = () => page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map((e, i) => `${i}:${e.getAttribute('aria-label') || e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText?.trim() || ''}|${e.type}|${e.placeholder}|${e.value}`).filter(s => !/\|Search\|/.test(s)));
const note = async (label, fn) => {
  try { await fn(); await page.waitForTimeout(1500); } catch (e) { log.push(`${label}: FAILED ${String(e).slice(0, 200)}`); }
  log.push(`== ${label}\nproblems: ${await page.getByText(/problems? to fix/).last().innerText().catch(() => 'none')}\nerrors: ${(await page.locator('main .Mui-error:visible').evaluateAll(els => els.map(e => e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText || '?'))).join(',')}\noptions: ${(await page.getByRole('option').allInnerTexts()).join(' ; ')}\ninputs: ${(await inputs()).join(' ;; ')}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png` });
};
const toSub = async t => {
  await page.goto('/suppliers/18/products');
  await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
  await page.waitForTimeout(4000);
  await page.getByRole('tab', { name: t, exact: true }).last().click();
  await page.waitForTimeout(3000);
};

// ---- Allotment
await toSub('Allotment');
await btn('Add allotment').click();
await page.waitForTimeout(3000);
await note('allotment empty save', () => btn('Save').click());
await note('allotment problems click', () => page.getByText(/problems? to fix/).last().click());
await page.keyboard.press('Escape');
await note('allotment Rooms options', () => page.locator('main input:visible').filter({ has: page.locator('xpath=.') }).nth(0).click().then(() => page.getByPlaceholder(/room/i).first().click()));
await page.keyboard.press('Escape');
await note('allotment type options', () => page.locator('main input[value="Guaranteed"], main input[value="Free sale"], main input[value="On request"]').first().click());
await page.keyboard.press('Escape');
await note('allotment add block', () => btn('Add block').click());

// ---- Promotion
await toSub('Promotions');
await btn('Add promotion').click();
await page.waitForTimeout(3000);
await note('promotion empty save', () => btn('Save').click());
await note('promotion applies-to options', () => page.getByPlaceholder(/contract/i).first().click());
await page.keyboard.press('Escape');

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n') + '\n\nSENT:\n' + sent.join('\n'));
console.log(log.join('\n'));
console.log('SENT:\n' + sent.join('\n'));
await browser.close();
