// Helper (not a test): READ-ONLY - Contracts module filters, bulk bar, rates and row click. Run: node scripts/probe-contracts-module2.mjs <outDir>
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
const clean = a => a.map(s => s.replace(/[\s\u200b]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const open = async () => { await page.goto('/contracts'); await page.locator('main tbody tr').first().waitFor({ timeout: 90_000 }); await wait(2500); };
const run = async (n, f) => { try { await f(); } catch (e) { log('!! ' + n, e.message.split('\n')[0]); } await page.keyboard.press('Escape').catch(() => {}); };
await open();
const combos = page.locator('main [role=combobox]:visible');
log('combos', clean(await combos.allInnerTexts()).concat(await combos.evaluateAll(e => e.map(x => x.getAttribute('placeholder') || x.value || ''))));
for (let i = 0; i < await combos.count(); i++) await run('combo' + i, async () => {
  await combos.nth(i).click(); await wait(1500);
  log(`combo ${i} options`, clean(await page.getByRole('option').allInnerTexts()).slice(0, 15));
});
await run('status Draft', async () => {
  await page.locator('main [role=combobox]', { hasText: 'Any status' }).click(); await wait(800);
  await page.getByRole('option', { name: 'Draft' }).click(); await wait(3000);
  log('status=Draft rows', clean(await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.slice(0, 80)));
});
await open();
await run('active off', async () => {
  await page.locator('main [role=combobox]', { hasText: /^Active$/ }).click(); await wait(800);
  log('active options', clean(await page.getByRole('option').allInnerTexts()));
});
await run('search', async () => {
  await open();
  await page.getByPlaceholder('Contract, code or supplier').fill('Connaught'); await wait(3000);
  log('search Connaught', clean(await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.slice(0, 80)));
  await page.getByPlaceholder('Contract, code or supplier').fill('zzzqqq'); await wait(3000);
  log('search none', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 300));
});
await run('select', async () => {
  await open();
  await page.locator('main tbody tr:visible input[type=checkbox]').first().check(); await wait(1500);
  log('after select', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400));
  log('after select buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 20));
  await page.screenshot({ path: `${DIR}/contracts-selected.png` });
  for (const b of ['Roll over', 'Extend', 'Reprice']) {
    const btn = page.locator('main').getByRole('button', { name: new RegExp(b, 'i') }).first();
    if (!(await btn.count())) { log(b, 'no button'); continue; }
    await btn.click(); await wait(2500);
    const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
    log(b + ' dialog', (await d.innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 600));
    await page.screenshot({ path: `${DIR}/contracts-${b.replace(/ /g, '')}.png` });
    await page.keyboard.press('Escape'); await wait(800);
  }
});
await run('rates', async () => {
  await open();
  const cells = page.locator('main tbody tr:visible').first().locator('td');
  await cells.nth((await cells.count()) - 1).click(); await wait(3000);
  log('rates url', page.url());
  log('rates panel', clean(await page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiPopover-paper:visible').allInnerTexts()).map(s => s.slice(0, 500)));
  await page.screenshot({ path: `${DIR}/contracts-rates.png` });
});
await run('row', async () => {
  await open();
  await page.locator('main tbody tr:visible').first().locator('td').nth(1).click(); await wait(5000);
  log('row url', page.url()); log('row headings', clean(await page.getByRole('heading').allInnerTexts()).slice(0, 6));
  await page.screenshot({ path: `${DIR}/contracts-row.png` });
});
log('SENT', sent);
await browser.close();
