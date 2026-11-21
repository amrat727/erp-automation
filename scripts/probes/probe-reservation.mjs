// Helper (not a test): READ-ONLY deep look at Reservations (list quick filters + column filters, Add Reservation form,
// reservation 000003 tabs and buttons, Storefront / Amendment requests buttons). All saves blocked.
// Run: node scripts/probes/probe-reservation.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'reservation-probe';
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
const list = async () => { await page.goto('/reservations'); await page.locator('main tbody tr').first().waitFor({ timeout: 90_000 }); await wait(2500); };
const txt = async () => (await main().innerText()).replace(/\s+/g, ' ');

await run('list', async () => {
  await list();
  log('rows', clean(await page.locator('main tbody tr:visible').allInnerTexts()));
  const combos = page.locator('main thead [role=combobox]:visible');
  for (let i = 0; i < await combos.count(); i++) { await combos.nth(i).click(); await wait(800); log('header combo ' + i, clean(await page.getByRole('option').allInnerTexts()).slice(0, 15)); await page.keyboard.press('Escape'); await wait(300); }
  for (const qf of ['Arriving today', 'Arriving in 7 days', 'Travelling now', 'All']) {
    await main().getByRole('button', { name: qf, exact: true }).first().click(); await wait(2500);
    log('quick ' + qf, clean(await page.getByText(/^\d+–\d+ of \d+$/).allInnerTexts()) + ' ' + clean(await page.locator('main tbody tr:visible td:first-child').allInnerTexts()));
  }
  log('switches', await page.locator('main tbody tr:visible input[type=checkbox]').evaluateAll(e => e.map(x => (x.getAttribute('aria-label') || '?') + '=' + x.checked)));
  for (const b of ['Storefront', 'Amendment requests']) {
    await list(); await main().getByRole('button', { name: b, exact: true }).first().click(); await wait(3500);
    log(b + ' ->', page.url() + ' ' + clean(await page.getByRole('heading').allInnerTexts()).slice(0, 4));
  }
});
await run('add reservation', async () => {
  await page.goto('/reservations/new'); await page.getByRole('button', { name: 'Save Reservation' }).waitFor({ timeout: 90000 }); await wait(2000);
  log('form', (await txt()).slice(-900));
  log('buttons', clean(await main().getByRole('button').allInnerTexts()).slice(-12));
  for (const ph of ['Branch', 'Department', 'Exchange Type']) { const f = page.getByPlaceholder(ph).last(); if (!(await f.count())) continue; await f.click(); await wait(1200); log(ph + ' options', clean(await page.getByRole('option').allInnerTexts()).slice(0, 12)); await page.keyboard.press('Escape'); }
  await page.screenshot({ path: `${DIR}/res-add.png`, fullPage: true });
});
await run('reservation 000003', async () => {
  await list();
  await page.locator('main tbody tr:visible', { hasText: '000003' }).locator('td').nth(1).click(); await wait(5000);
  log('url', page.url());
  log('tabs', clean(await page.getByRole('tab').allInnerTexts()));
  log('header buttons', clean(await main().getByRole('button').allInnerTexts()).slice(19, 60));
  log('summary', (await txt()).slice(-1300));
  await page.screenshot({ path: `${DIR}/res-summary.png`, fullPage: true });
  for (const t of ['Itinerary', 'Travellers', 'Pricing', 'Accounting', 'Amendments', 'Feedback', 'History']) {
    const tab = page.getByRole('tab', { name: new RegExp('^' + t) }).first();
    if (!(await tab.count())) { log('tab ' + t, 'missing'); continue; }
    await tab.click(); await wait(3000);
    log('tab ' + t, (await txt()).slice(-1000));
    await page.screenshot({ path: `${DIR}/res-${t}.png`, fullPage: true });
  }
  for (const b of ['Documents', 'Data retention']) {
    await page.getByRole('tab', { name: /^Summary/ }).click(); await wait(1500);
    const btn = main().getByRole('button', { name: b, exact: true }).first();
    if (!(await btn.count())) { log(b, 'missing'); continue; }
    await btn.click(); await wait(3000);
    const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiPopover-paper:visible, .MuiMenu-paper:visible').last();
    log(b + ' opens', (await d.innerText().catch(() => 'nothing: ' + page.url())).replace(/\s+/g, ' ').slice(0, 700));
    await page.keyboard.press('Escape'); await wait(800);
  }
});
log('\nSENT (blocked)', sent);
await browser.close();
