// Helper (not a test): READ-ONLY - Excursion / Private transfer contract + allotment forms, promotion options, Core contact types.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-exc';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 1500)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const btn = name => page.getByRole('button', { name, exact: true }).last();
const dump = async label => {
  await page.waitForTimeout(1500);
  const text = clean(await page.locator('main').innerText().catch(() => '')).replace(/^.*?Promotions(\sRate check)?\s/, '').slice(0, 2500);
  const ins = await page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, (e.value || '').slice(0, 25)].filter(Boolean).join('|')).filter(s => !/Search|^text\|10$/.test(s)));
  const opts = (await page.getByRole('option').allInnerTexts()).map(clean);
  log.push(`== ${label}\n  TEXT: ${text}\n  INPUTS: ${ins.join(' ; ').slice(0, 1500)}` + (opts.length ? `\n  OPTIONS: ${opts.join(' ; ')}` : ''));
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label);
};
const toSub = async (product, sub) => {
  await page.goto('/suppliers/18/products');
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 }); await page.waitForTimeout(2000);
  await page.getByRole('button', { name: product, exact: true }).last().click(); await page.waitForTimeout(3500);
  await page.getByRole('tab', { name: sub, exact: true }).last().click(); await page.waitForTimeout(3500);
};
const tryIt = async (l, fn) => { try { await fn(); } catch (e) { log.push(`!! ${l}: ${String(e).split('\n')[0].slice(0, 140)}`); } await dump(l); };

for (const p of ['Excursion', 'Private transfer']) {
  await toSub(p, 'Contract');
  await tryIt(`${p} add contract`, () => btn('Add contract').click());
  await tryIt(`${p} empty save`, () => btn('Save').click());
  await tryIt(`${p} first dropdown`, () => page.getByPlaceholder(/Choose|Select/).first().click());
  await page.keyboard.press('Escape');
  await tryIt(`${p} add season/rate`, async () => { const b = page.getByRole('button', { name: /^Add (season|rate)$/ }).first(); await b.click(); await page.waitForTimeout(800); });
  await page.keyboard.press('Escape');
  await toSub(p, 'Allotment');
  await tryIt(`${p} add allotment`, () => btn('Add allotment').click());
}
await toSub('Hotel', 'Promotions');
await tryIt('promotion add', () => btn('Add promotion').click());
for (const s of ['Combinable', 'Stay / pay', 'Meal upgrade', 'Room upgrade', 'Free of charge (FOC)']) await tryIt(`promotion ${s}`, () => page.locator(`main input[aria-label="${s}"]`).first().click());
await tryIt('promotion add blackout', () => btn('Add blackout').click());
await tryIt('promotion applies-to options', () => page.getByPlaceholder('All active contracts').click());
await page.keyboard.press('Escape');
await page.goto('/contacttype'); await page.waitForTimeout(6000);
await dump('core contact types');
fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n') + '\n\nSENT:\n' + sent.join('\n'));
console.log(log.join('\n').slice(0, 30000));
await browser.close();
