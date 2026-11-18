// Helper (not a test): READ-ONLY deep look at Quotes (list quick filters, column filters, Add Quote form, QT-000001 tabs and buttons). All saves blocked.
// Run: node scripts/probe-quotes.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'quotes-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const q = r.request(); if (['POST','PUT','DELETE','PATCH'].includes(q.method()) && !/negotiate|\/auth\//.test(q.url())) { sent.push(`${q.method()} ${q.url()} ${(q.postData() || '').slice(0, 200)}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const clean = a => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const run = async (n, f) => { console.log(`\n--- ${n}`); try { await f(); } catch (e) { log('!!', e.message.split('\n')[0]); } await page.keyboard.press('Escape').catch(() => {}); };
const main = () => page.locator('main');
const list = async () => { await page.goto('/quotes'); await page.locator('main tbody tr').first().waitFor({ timeout: 90_000 }); await wait(2500); };
const tabText = async () => (await main().innerText()).replace(/\s+/g, ' ');

await run('list', async () => {
  await list();
  log('quick filters', clean(await main().getByRole('button').allInnerTexts()).slice(0, 6));
  log('row', clean(await page.locator('main tbody tr:visible').allInnerTexts()));
  const combos = page.locator('main thead [role=combobox]:visible');
  for (let i = 0; i < await combos.count(); i++) { await combos.nth(i).click(); await wait(800); log('header combo ' + i, clean(await page.getByRole('option').allInnerTexts()).slice(0, 15)); await page.keyboard.press('Escape'); await wait(300); }
  for (const q of ['Quoted today', 'Last 7 days', 'Last 30 days', 'Follow-up due', 'All']) {
    await main().getByRole('button', { name: q, exact: true }).first().click(); await wait(2500);
    log('quick ' + q, (await page.locator('main tbody').innerText()).replace(/\s+/g, ' ').slice(0, 160) + ' | ' + clean(await page.getByText(/^\d+–\d+ of \d+$/).allInnerTexts()));
  }
  log('switch', await page.locator('main tbody tr:visible input[type=checkbox]').evaluateAll(e => e.map(x => (x.getAttribute('aria-label') || '?') + '=' + x.checked)));
  await page.locator('main tbody tr:visible input[type=checkbox]').first().click().catch(() => {}); await wait(1500);
  log('switch popup', clean(await page.locator('.swal2-popup:visible').allInnerTexts()));
  const cancel = page.locator('.swal2-popup:visible').getByRole('button', { name: 'Cancel' }); if (await cancel.count()) await cancel.click();
});
await run('add quote', async () => {
  await page.goto('/quotes/new'); await page.getByRole('button', { name: 'Save Quote' }).waitFor({ timeout: 90000 }); await wait(2000);
  log('text', (await tabText()).slice(-1500));
  const agent = page.getByPlaceholder('Agent').first(); await agent.click(); await wait(2000);
  log('agent options', clean(await page.getByRole('option').allInnerTexts()).slice(0, 25));
  await page.keyboard.press('Escape');
  const src = page.getByPlaceholder('Source').first(); if (await src.count()) { await src.click(); await wait(1200); log('source options', clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape'); }
  const ex = page.getByPlaceholder('Exchange Type').first(); if (await ex.count()) { await ex.click(); await wait(1200); log('exchange options', clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape'); }
  log('config buttons', clean(await main().getByRole('button').allInnerTexts()).slice(-12));
  await page.locator('main [data-testid*=Add], main button[aria-label]').evaluateAll(e => e.map(x => x.getAttribute('aria-label'))).then(a => log('aria buttons', a.filter(Boolean).slice(0, 30)));
  await page.screenshot({ path: `${DIR}/quote-add.png`, fullPage: true });
});
await run('quote 1', async () => {
  await page.goto('/quotes/1'); await page.getByRole('tab', { name: /^Summary/ }).waitFor({ timeout: 90000 }); await wait(3000);
  log('tabs', clean(await page.getByRole('tab').allInnerTexts()));
  log('buttons', clean(await main().getByRole('button').allInnerTexts()).slice(19, 60));
  log('summary', (await tabText()).slice(-1200));
  await page.screenshot({ path: `${DIR}/quote-summary.png`, fullPage: true });
  for (const t of ['Itinerary', 'Pricing', 'Follow-ups', 'Versions', 'History']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).click(); await wait(2500);
    log('tab ' + t, (await tabText()).slice(-900));
    await page.screenshot({ path: `${DIR}/quote-${t}.png`, fullPage: true });
  }
  for (const b of ['Document', 'Preview', 'Send to customer']) {
    await page.getByRole('tab', { name: /^Summary/ }).click(); await wait(1500);
    const btn = main().getByRole('button', { name: b, exact: true }).first();
    if (!(await btn.count())) { log(b, 'missing'); continue; }
    await btn.click(); await wait(3000);
    const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiPopover-paper:visible, .MuiMenu-paper:visible').last();
    log(b + ' opens', (await d.innerText().catch(() => 'nothing: ' + page.url())).replace(/\s+/g, ' ').slice(0, 600));
    await page.screenshot({ path: `${DIR}/quote-${b.replace(/ /g, '')}.png` });
    await page.keyboard.press('Escape'); await wait(800);
  }
});
log('\nSENT (blocked)', sent);
await browser.close();
