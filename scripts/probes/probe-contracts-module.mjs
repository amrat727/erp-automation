// Helper (not a test): READ-ONLY deep look at the top-level Contracts module (/contracts). All saves blocked.
// Run: node scripts/probes/probe-contracts-module.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'contracts-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const m = r.request().method(); if (['POST','PUT','DELETE','PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
page.on('response', r => { if (r.request().method() === 'GET' && /contract/i.test(r.url()) && r.status() < 300) console.log('GET', r.url().slice(0, 160)); });
const clean = a => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const open = async () => { await page.goto('/contracts'); await page.locator('main tbody tr').first().waitFor({ timeout: 90_000 }); await wait(2500); };

await open();
log('text', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 1500));
log('rows', clean(await page.locator('main tbody tr:visible').allInnerTexts()));
log('row switches', await page.locator('main tbody tr:visible input[type=checkbox]').evaluateAll(e => e.map(x => (x.getAttribute('aria-label') || '') + '=' + x.checked)));
log('row buttons', clean(await page.locator('main tbody tr:visible').first().locator('button, a').evaluateAll(e => e.map(x => (x.getAttribute('aria-label') || x.innerText || x.getAttribute('href') || '').trim()))));
await page.screenshot({ path: `${DIR}/contracts-list.png`, fullPage: true });
// filters
for (const ph of ['All suppliers', 'Any status', 'Ending any time']) {
  const f = page.getByPlaceholder(ph).or(page.locator(`main input[value="${ph}"]`)).first();
  if (!(await f.count())) { log('filter ' + ph, 'not found'); continue; }
  await f.click(); await wait(1500);
  log('filter ' + ph, clean(await page.getByRole('option').allInnerTexts()).slice(0, 30));
  await page.keyboard.press('Escape'); await wait(500);
}
const act = page.locator('main input').filter({ has: page.locator('xpath=.') }).nth(0);
// the "Active" filter
const actives = page.locator('main input[value="true"], main input[value="Active"]');
log('active filter inputs', await actives.count());
if (await actives.count()) { await actives.first().click(); await wait(1200); log('active filter options', clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape'); }
// search
await page.getByPlaceholder('Contract, code or supplier').fill('Connaught'); await wait(3000);
log('search Connaught', clean(await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.slice(0, 90)));
await page.getByPlaceholder('Contract, code or supplier').fill('zzzqqq'); await wait(3000);
log('search none', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400));
await open();
// select a row -> bulk bar
await page.locator('main tbody tr:visible input[type=checkbox]').first().check().catch(() => {}); await wait(1500);
log('after select', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 30));
await page.screenshot({ path: `${DIR}/contracts-selected.png`, fullPage: true });
// sortable headers
log('header buttons', clean(await page.locator('main thead button, main thead [role=button]').allInnerTexts()));
// rates column / row click
await open();
const first = page.locator('main tbody tr:visible').first();
const cells = first.locator('td');
log('cell count', await cells.count());
const ratesCell = cells.nth((await cells.count()) - 1);
await ratesCell.click().catch(() => {}); await wait(3000);
log('after rates click url', page.url());
log('after rates click dialogs', clean(await page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiPopover-paper:visible').allInnerTexts()).map(s => s.slice(0, 500)));
await page.screenshot({ path: `${DIR}/contracts-rates-click.png`, fullPage: true });
await open();
await page.locator('main tbody tr:visible').first().locator('td').nth(1).click(); await wait(5000);
log('row click url', page.url());
log('row click headings', clean(await page.getByRole('heading').allInnerTexts()).slice(0, 6));
await page.screenshot({ path: `${DIR}/contracts-row-click.png`, fullPage: true });
log('SENT', sent);
await browser.close();
