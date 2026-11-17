// Helper (not a test): READ-ONLY map of the supplier areas not yet covered: Excursion / Private transfer contract + allotment forms,
// promotion details, audit history, documents upload, contact roles in Core. Every save is blocked and recorded.
// Run:  node scripts/probe-supplier-rest.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-supplier-rest';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 900)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const safe = async p => { try { return await p; } catch { return []; } };
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(1800); } catch (e) { log.push(`!! ${label}: ${String(e).split('\n')[0].slice(0, 150)}`); }
  const dlg = (await safe(page.getByRole('dialog').allInnerTexts())).map(s => clean(s).slice(0, 1200));
  const errs = [...new Set((await safe(page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts())).map(clean).filter(s => s && s !== '​'))];
  const opts = (await safe(page.getByRole('option').allInnerTexts())).map(clean);
  const text = clean(await page.locator('main').innerText().catch(() => '')).replace(/^.*?(Rate check|Promotions)\s/, '').slice(0, 1500);
  log.push(`== ${label}  [${page.url().replace('https://erp.nexgenpilot.com', '')}]` + (dlg.length ? `\n  DIALOG: ${dlg.join(' || ')}` : '') + (errs.length ? `\n  ERRORS: ${errs.join(' ; ')}` : '') +
    (opts.length ? `\n  OPTIONS: ${opts.join(' ; ')}` : '') + `\n  TEXT: ${text}` + `\n  SENT: ${sent.slice(before).join(' || ') || 'none'}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  console.log('step', n, label);
};
const go = async p => { for (let i = 0; i < 3; i++) { try { await page.goto(p); break; } catch { await page.waitForTimeout(1500); } } await page.waitForTimeout(4000); };
const vbtn = n => page.locator('main button:visible', { hasText: new RegExp(`^${n}$`) }).first();
const toSub = async (product, sub) => {
  await go('/suppliers/18/products');
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 }); await page.waitForTimeout(2000);
  await page.getByRole('button', { name: product, exact: true }).last().click(); await page.waitForTimeout(3500);
  await page.getByRole('tab', { name: sub, exact: true }).last().click(); await page.waitForTimeout(3500);
};

// Excursion / Private transfer: contract + allotment forms
for (const p of ['Excursion', 'Private transfer']) {
  await toSub(p, 'Contract');
  await step(`${p}: contract list`, async () => {});
  await step(`${p}: add contract`, () => vbtn('Add contract').click());
  await step(`${p}: base plan / rate basis options`, async () => { const f = page.getByPlaceholder(/base plan|rate basis|Choose/i).first(); await f.click(); });
  await page.keyboard.press('Escape');
  await step(`${p}: add contract empty save`, () => vbtn('Save').click());
  await toSub(p, 'Allotment');
  await step(`${p}: add allotment`, () => vbtn('Add allotment').click());
  await step(`${p}: allotment unit options`, () => page.getByPlaceholder('Choose a unit').click());
  await page.keyboard.press('Escape');
}
// Promotion details on Hotel
await toSub('Hotel', 'Promotions');
await step('promotion: add form', () => vbtn('Add promotion').click());
await step('promotion: combinable on', () => page.locator('main input[aria-label="Combinable"]').click());
await step('promotion: add blackout', () => vbtn('Add blackout').click());
await step('promotion: stay/pay on', () => page.locator('main input[aria-label="Stay / pay"]').click());
await step('promotion: meal upgrade on', () => page.locator('main input[aria-label="Meal upgrade"]').click());
await step('promotion: room upgrade on', () => page.locator('main input[aria-label="Room upgrade"]').click());
await step('promotion: FOC on', () => page.locator('main input[aria-label="Free of charge (FOC)"]').click());
// Audit history
await go('/suppliers');
await step('supplier list: Audit history', () => vbtn('Audit history').click());
await go('/suppliers/18/overview');
await step('supplier: History button', () => page.locator('main button[aria-label*="istory" i]:visible, main button[title*="istory" i]:visible').first().click());
await page.keyboard.press('Escape');
// Documents
await go('/suppliers/18/overview');
await step('supplier: Edit -> documents area', async () => { await page.getByRole('button', { name: 'Edit', exact: true }).first().click(); await page.waitForTimeout(1500); await page.locator('main button:visible', { hasText: /^Upload$/ }).first().scrollIntoViewIfNeeded(); });
log.push('file inputs: ' + JSON.stringify(await page.locator('main input[type=file]').evaluateAll(els => els.map(e => ({ accept: e.accept, multiple: e.multiple, name: e.name || e.closest('div')?.innerText?.slice(0, 60) })))));
// Core: contact roles
await go('/dashboard');
await step('core menu', async () => { await page.getByText('Core', { exact: true }).first().click(); await page.waitForTimeout(1500); });
log.push('core menu items: ' + (await page.locator('nav a:visible, aside a:visible, [role=navigation] a:visible').allInnerTexts()).map(clean).join(' | '));

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
