// Helper (not a test): READ-ONLY map of Supplier -> Products -> <product> -> "Products" sub-tab (rooms / items) for Hotel,
// Excursion and Private transfer: lists, add forms, edit forms, validation. Every save is blocked and recorded.
// Run:  node scripts/probe-products.mjs <outDir> [supplierId]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-products';
const ID = process.argv[3] ?? '18';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
let n = 0;
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ at: n, req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 2500) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
const clean = s => s.replace(/\s+/g, ' ').trim();
const safe = async p => { try { return await p; } catch { return []; } };
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(2000); } catch (e) { log.push(`!! ${label}: ${String(e).split('\n')[0].slice(0, 160)}`); }
  await page.waitForTimeout(800);
  const dlg = (await safe(page.getByRole('dialog').allInnerTexts())).map(s => clean(s).slice(0, 1500));
  const errs = (await safe(page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts())).map(clean).filter(s => s && s !== '​');
  const opts = (await safe(page.getByRole('option').allInnerTexts())).map(clean);
  const btns = [...new Set((await safe(page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '?') + (e.disabled ? '[DIS]' : ''))))).map(clean))]
    .filter(b => !/^(Share|Open|Open calendar|\?|Add supplier|Audit history|Columns|Overview|Contacts|Financials|Content|Go to .*)$/.test(b));
  const inputs = await safe(page.locator('main input:visible, main textarea:visible, [role=dialog] input:visible, [role=dialog] textarea:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText?.trim() || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', e.maxLength > 0 ? 'max' + e.maxLength : '', e.min ? 'min' + e.min : '', (e.value || '').slice(0, 30)].filter(Boolean).join('|')).filter(s => !/^text\|Search$|^\|?text\|Search/.test(s))));
  const text = clean(await page.locator('main').innerText().catch(() => '')).replace(/^.*?Rate check/, '').slice(0, 1800);
  log.push(`== ${label}  [${page.url().replace('https://erp.nexgenpilot.com', '')}]` +
    (dlg.length ? `\n  DIALOG: ${dlg.join(' || ')}` : '') + (errs.length ? `\n  ERRORS: ${errs.join(' ; ')}` : '') +
    (opts.length ? `\n  OPTIONS: ${opts.join(' ; ')}` : '') + `\n  BUTTONS: ${btns.join(' ; ')}` + `\n  INPUTS: ${inputs.join(' ; ').slice(0, 1500)}` +
    `\n  TEXT: ${text}` + `\n  SENT: ${sent.slice(before).map(s => s.req + '\n    ' + s.body).join('\n  ') || 'none'}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  console.log('step', n, label);
};
const btn = (name, exact = true) => page.getByRole('button', { name, exact }).last();
const esc = () => page.keyboard.press('Escape');
const toProduct = async product => {
  for (let i = 0; i < 3; i++) { try { await page.goto(`/suppliers/${ID}/products`); break; } catch { await page.waitForTimeout(1500); } }
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: product, exact: true }).last().click();
  await page.waitForTimeout(4000);
};

for (const product of ['Hotel', 'Excursion', 'Private transfer']) {
  await toProduct(product);
  await step(`${product}: Products list`, async () => {});
  await step(`${product}: list view toggle`, () => page.locator('main button:visible').filter({ has: page.locator('svg') }).last().click());
  await step(`${product}: Inactive filter`, () => page.locator('main button:visible', { hasText: /^Inactive/ }).first().click());
  await step(`${product}: search "zzz"`, async () => { await page.locator('main button:visible', { hasText: /^All/ }).first().click(); await page.getByPlaceholder(/^Search/).last().fill('zzz'); });
  await toProduct(product);
  // first existing item
  await step(`${product}: open first item`, async () => {
    const card = page.locator('main [role=button]:visible, main .MuiCard-root:visible').filter({ hasNotText: /^Add / }).first();
    const chip = page.locator('main button:visible').filter({ hasNotText: /^(Add|All|Active|Inactive|Products|Contract|Allotment|Promotions|Rate check|Accommodation|Excursion|Transfer|Hotel|Private transfer)/ }).first();
    if (await card.count()) await card.click(); else await chip.click();
    await page.waitForTimeout(3500);
  });
  await step(`${product}: item Edit`, () => btn('Edit').click());
  await step(`${product}: item clear name + Save`, async () => { const f = page.locator('main input[type=text]:visible:not([disabled])').filter({ hasNot: page.locator('[placeholder^="Search"]') }).first(); await f.fill(''); await btn('Save').click(); });
  await btn('Cancel').click().catch(() => {});
  // add form
  await toProduct(product);
  const add = page.locator('main button:visible', { hasText: /^Add / }).first();
  await step(`${product}: Add form`, () => add.click());
  await step(`${product}: Add empty Save`, () => btn('Save').click().catch(() => btn('Create').click()));
  await step(`${product}: Add form dropdowns`, async () => { const cb = page.locator('main [role=combobox]:visible, [role=dialog] [role=combobox]:visible').first(); await cb.click(); });
  await esc();
  await step(`${product}: Add Cancel`, () => btn('Cancel').click());
}

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
