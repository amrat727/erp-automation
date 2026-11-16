// Helper (not a test): READ-ONLY - targeted map of the product (room / excursion / transfer) forms: open existing, empty create,
// dropdown options, wrong values (age policy, occupancy, capacity). Every save is blocked and its body recorded.
// Run:  node scripts/probe-products2.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-products2';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
let n = 0;
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 3000) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
const clean = s => s.replace(/\s+/g, ' ').trim();
const safe = async p => { try { return await p; } catch { return []; } };
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(1800); } catch (e) { log.push(`!! ${label}: ${String(e).split('\n')[0].slice(0, 160)}`); }
  const dlg = (await safe(page.getByRole('dialog').allInnerTexts())).map(s => clean(s).slice(0, 800));
  const errs = [...new Set((await safe(page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts())).map(clean).filter(s => s && s !== '​'))];
  const opts = (await safe(page.getByRole('option').allInnerTexts())).map(clean);
  const inputs = await safe(page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', e.min ? 'min' + e.min : '', e.max ? 'max' + e.max : '', e.maxLength > 0 ? 'len' + e.maxLength : '', (e.value || '').slice(0, 30)].filter(Boolean).join('|')).filter(s => !/Search/.test(s))));
  log.push(`== ${label}` + (dlg.length ? `\n  DIALOG: ${dlg.join(' || ')}` : '') + (errs.length ? `\n  ERRORS: ${errs.join(' ; ')}` : '') + (opts.length ? `\n  OPTIONS: ${opts.join(' ; ')}` : '') +
    `\n  INPUTS: ${inputs.join(' ; ').slice(0, 1800)}` + `\n  SENT: ${sent.slice(before).map(s => s.req + '\n    ' + s.body).join('\n  ') || 'none'}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  console.log('step', n, label);
};
const btn = (name, exact = true) => page.getByRole('button', { name, exact }).last();
const esc = () => page.keyboard.press('Escape');
const field = label => page.locator('main').getByText(label, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root") or contains(@class,"MuiGrid")][1]').locator('input').first();
const toProduct = async (id, product) => {
  for (let i = 0; i < 3; i++) { try { await page.goto(`/suppliers/${id}/products`); break; } catch { await page.waitForTimeout(1500); } }
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: product, exact: true }).last().click();
  await page.waitForTimeout(4000);
};

// ---------------- HOTEL ROOMS (supplier 18) ----------------
await toProduct(18, 'Hotel');
await step('hotel: open room Club', () => btn('Club').click());
await step('hotel: Table view', async () => { await toProduct(18, 'Hotel'); await btn('Table view').click(); });
await toProduct(18, 'Hotel');
await btn('Club').click(); await page.waitForTimeout(3000);
await step('hotel: Club clear name + Save', async () => { await page.getByPlaceholder(/room name/i).first().fill(''); await page.getByRole('button', { name: /^(Save|Save changes|Update product)$/ }).last().click(); });
await toProduct(18, 'Hotel');
await step('hotel: Add room form', () => btn('Add room').click());
await step('hotel: Add room empty Create', () => btn('Create product').click());
for (const f of ['View', 'Charged per', 'Sell as']) await step(`hotel: ${f} options`, async () => { await field(f).click(); }).then(esc);
await step('hotel: bed type options', () => page.locator('main table:visible').last().locator('tbody tr').first().locator('input').first().click()).then(esc);
await step('hotel: fill room + bad age policy + adults 0 + Create', async () => {
  await page.getByPlaceholder(/room name/i).first().fill('QA Probe Room');
  for (const f of ['View', 'Charged per']) { await field(f).click(); await page.waitForTimeout(600); if (await page.getByRole('option').count()) await page.getByRole('option').first().click(); }
  const ages = page.locator('main').getByText('Age policy').first().locator('xpath=ancestor::div[3]').locator('input');
  log.push('age inputs: ' + await ages.count());
  if (await ages.count() >= 6) { await ages.nth(0).fill('0'); await ages.nth(1).fill('5'); await ages.nth(2).fill('3'); await ages.nth(3).fill('12'); await ages.nth(4).fill('10'); await ages.nth(5).fill('99'); }
  await btn('Create product').click();
});
await step('hotel: Add room Cancel', () => btn('Cancel').click());

// ---------------- EXCURSION (supplier 18) ----------------
await toProduct(18, 'Excursion');
await step('excursion: open Jungle Safari', () => btn('Jungle Safari Abu Dhabi').click());
await toProduct(18, 'Excursion');
await step('excursion: Add form', () => btn('Add excursion').click());
await step('excursion: empty Create', () => btn('Create product').click());
for (const f of ['City', 'Service on', 'Service by', 'Sell as']) await step(`excursion: ${f} options`, async () => { await field(f).click(); }).then(esc);
await step('excursion: Add pax band', () => btn('Add pax band').click());
await step('excursion: fill + capacity 0 + Create', async () => {
  await page.getByPlaceholder(/product name/i).first().fill('QA Probe Excursion');
  for (const f of ['Service on', 'Service by']) { await field(f).click(); await page.waitForTimeout(600); if (await page.getByRole('option').count()) await page.getByRole('option').first().click(); }
  await field('Max capacity').fill('0');
  await btn('Create product').click();
});
await step('excursion: capacity -5 + Create', async () => { await field('Max capacity').fill('-5'); await btn('Create product').click(); });
await step('excursion: Cancel', () => btn('Cancel').click());

// ---------------- PRIVATE TRANSFER (supplier 18) + an existing one (Desert Line Transfers) ----------------
await toProduct(18, 'Private transfer');
await step('transfer: Add form', () => btn('Add private transfer').click());
await step('transfer: empty Create', () => btn('Create product').click());
for (const f of ['Service on', 'Service by', 'Sell as']) await step(`transfer: ${f} options`, async () => { await field(f).click(); }).then(esc);
await step('transfer: Cancel', () => btn('Cancel').click());

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
