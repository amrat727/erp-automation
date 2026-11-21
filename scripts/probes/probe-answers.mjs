// Helper (not a test): READ-ONLY checks of the round-3 answers that may be bugs (all saves blocked).
// Run: node scripts/probes/probe-answers.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'answers-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const q = r.request(); if (['POST','PUT','DELETE','PATCH'].includes(q.method()) && !/negotiate|\/auth\/|rate-quote/.test(q.url())) { sent.push(`${q.method()} ${q.url()} ${(q.postData() || '').slice(0, 600)}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const wait = ms => page.waitForTimeout(ms);
const clean = a => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const run = async (name, fn) => { console.log(`\n----- ${name}`); try { await fn(); } catch (e) { console.log('!! ' + e.message.split('\n')[0]); } };
const SUP = 18;
const openProduct = async (product, sub) => {
  await page.goto(`/suppliers/${SUP}/products`);
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 }); await wait(1500);
  await page.locator('main button:visible', { hasText: new RegExp(`^${product}$`) }).first().click(); await wait(3000);
  if (sub) { await page.locator('main button:visible, main [role=tab]:visible', { hasText: new RegExp(`^${sub}`) }).first().click(); await wait(3000); }
};

await run('S-10 room: is there an Active switch?', async () => {
  await openProduct('Hotel');
  log('room buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 30));
  await page.locator('main button:visible', { hasText: /^Club$/ }).first().click().catch(() => {}); await wait(3000);
  log('room view buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 40));
  log('switches', await page.locator('main input[type=checkbox]:visible').evaluateAll(e => e.map(x => x.getAttribute('aria-label') || (x.closest('label')?.textContent ?? '').trim())));
  await page.screenshot({ path: `${DIR}/s10-room.png`, fullPage: true });
});

await run('S3-01 contracts of On hold supplier "Testing season 3"', async () => {
  await page.goto(`/suppliers/${SUP}/overview`); await wait(6000);
  log('supplier status', clean(await page.locator('main').getByText(/^(On hold|Approved|Blocked)$/).allInnerTexts()).slice(0, 3));
  await openProduct('Hotel', 'Contract');
  log('contract rows', clean((await page.locator('main table:visible').last().locator('tbody tr').allInnerTexts())).slice(0, 12).map(s => s.slice(0, 140)));
  await page.screenshot({ path: `${DIR}/s3-01-contracts.png`, fullPage: true });
});

await run('S3-05 / S3-10 contract + promotion fields (combinable, tax)', async () => {
  await openProduct('Hotel', 'Contract');
  await page.locator('main').getByRole('button', { name: /Add contract/i }).last().click(); await wait(5000);
  const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  log('contract form has tax/VAT/commission', { tax: /tax/i.test(txt), vat: /vat/i.test(txt), commission: /commission/i.test(txt), tourism: /tourism/i.test(txt) });
  log('contract labels', clean(await page.locator('main label:visible, main .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 60));
  log('contract buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(-40));
  await page.screenshot({ path: `${DIR}/s3-10-contract-form.png`, fullPage: true });
  // S-09: save with a season but no prices
  await page.locator('main input:visible').first().fill('QA Auto probe no prices');
  await page.locator('main').getByRole('button', { name: /Add season/i }).first().click().catch(e => log('add season', e.message.slice(0, 60))); await wait(2000);
  const before = sent.length;
  await page.locator('main').getByRole('button', { name: /^Save( as draft)?$/i }).last().click().catch(e => log('save', e.message.slice(0, 60))); await wait(4000);
  log('S-09 messages', clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible, .Mui-error:visible, .swal2-popup:visible').allInnerTexts()).slice(0, 10));
  log('S-09 sent', sent.slice(before).map(s => s.slice(0, 200)));
  await page.screenshot({ path: `${DIR}/s09-draft-no-prices.png`, fullPage: true });
});

await run('S3-05 promotion form', async () => {
  await openProduct('Hotel', 'Promotions');
  await page.locator('main').getByRole('button', { name: /Add promotion/i }).last().click(); await wait(5000);
  const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  log('promotion has combin/cumulat/stack/best', { combin: /combin/i.test(txt), cumul: /cumulat/i.test(txt), stack: /stack/i.test(txt), best: /best offer/i.test(txt) });
  log('promotion labels', clean(await page.locator('main label:visible, main .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 60));
  log('promotion switches', await page.locator('main input[type=checkbox]:visible').evaluateAll(e => e.map(x => (x.closest('label')?.textContent ?? x.getAttribute('aria-label') ?? '').trim())));
  await page.screenshot({ path: `${DIR}/s3-05-promotion-form.png`, fullPage: true });
});

await run('S-06 phone without country code', async () => {
  await page.goto(`/suppliers/${SUP}/contacts`); await wait(4000);
  await page.getByRole('button', { name: 'Add contact', exact: true }).locator('visible=true').first().click({ timeout: 60_000 }); await wait(2000);
  const d = page.locator('.MuiDialog-paper:visible').last();
  await d.getByPlaceholder('Full name').fill('QA Auto phone check');
  await d.getByPlaceholder(/Reservations, Sales/).click(); await wait(1500);
  const opt = page.getByRole('option').first(); if (await opt.count()) await opt.click(); else log('role options', 'none');
  await d.getByPlaceholder('Phone number').fill('5550900');
  await d.getByPlaceholder('Mobile number').fill('abc');
  const before = sent.length;
  await d.getByRole('button', { name: 'Save' }).click(); await wait(3000);
  log('phone messages', clean(await d.locator('p, span').evaluateAll(els => els.filter(e => e.children.length === 0 && /phone|mobile|number|country/i.test(e.textContent ?? '') && getComputedStyle(e).color.startsWith('rgb(2')).map(e => e.textContent ?? ''))));
  log('phone sent', sent.slice(before).map(s => s.slice(0, 300)));
  await page.screenshot({ path: `${DIR}/s06-phone.png`, fullPage: true });
});
log('\nSENT (all blocked)', sent.length);
await browser.close();
