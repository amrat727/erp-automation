// Helper (not a test): READ-ONLY look at Enquiries, Amendment Requests, Feedback, Reports, Playground and the Dashboard.
// All saves blocked.  Run: node scripts/probes/probe-small-modules.mjs <outDir> [only]
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'small-probe';
const ONLY = process.argv[3];
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
const run = async (n, f) => { if (ONLY && !n.toLowerCase().includes(ONLY.toLowerCase())) return; console.log(`\n=== ${n}`); try { await f(); } catch (e) { log('!!', e.message.split('\n')[0]); } await page.keyboard.press('Escape').catch(() => {}); };
const main = () => page.locator('main');
const txt = async () => (await main().innerText()).replace(/\s+/g, ' ');
const panel = () => page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiPopover-paper:visible, .MuiMenu-paper:visible').last();

await run('enquiries', async () => {
  await page.goto('/enquiries'); await page.getByRole('heading', { name: 'Enquiries' }).waitFor({ timeout: 90000 }); await wait(3000);
  log('text', (await txt()).slice(0, 700));
  for (const f of ['Source', 'Assigned to', 'Follow-up']) { await main().getByRole('button', { name: f, exact: true }).first().click(); await wait(1200); log(f + ' menu', clean([await panel().innerText().catch(() => '')])); await page.keyboard.press('Escape'); await wait(400); }
  for (const t of ['New', 'In progress', 'Quoted', 'Won', 'Lost', 'Closed', 'All']) { await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click(); await wait(1500); log('tab ' + t, (await page.locator('main tbody').innerText()).replace(/\s+/g, ' ').slice(0, 120)); }
  await main().getByRole('button', { name: 'New enquiry' }).click(); await wait(2500);
  log('form', (await panel().innerText()).replace(/\s+/g, ' ').slice(0, 900));
  const src = panel().locator('[role=combobox]').first(); await src.click(); await wait(1000); log('source options', clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape');
  await page.screenshot({ path: `${DIR}/enquiry-form.png`, fullPage: true });
  // invalid email
  await panel().getByPlaceholder('Full name').fill('QA Auto Enquiry'); await panel().locator('input[type=email]').fill('abc');
  await panel().getByRole('button', { name: 'Create enquiry' }).click(); await wait(2500);
  log('bad email', clean([await panel().innerText()]).map(s => s.slice(0, 300)));
  log('sent after bad email', sent);
});
await run('amendments', async () => {
  await page.goto('/amendments'); await page.getByRole('heading', { name: 'Amendment Requests' }).waitFor({ timeout: 90000 }); await wait(3000);
  log('text', (await txt()).slice(0, 1500));
  const show = page.locator('main [role=combobox]').first(); await show.click(); await wait(1000); log('show options', clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape');
  for (const b of ['Timeline (1)', 'Quote', 'Reject']) { const btn = main().getByRole('button', { name: b, exact: true }).first(); if (!(await btn.count())) { log(b, 'missing'); continue; } await btn.click(); await wait(2500); log(b + ' opens', (await panel().innerText().catch(() => 'nothing')).replace(/\s+/g, ' ').slice(0, 700)); await page.screenshot({ path: `${DIR}/amend-${b.replace(/\W/g, '')}.png` }); await page.keyboard.press('Escape'); await wait(800); }
  log('sent', sent);
});
await run('feedback', async () => {
  await page.goto('/feedback'); await page.getByRole('heading', { name: 'Feedback' }).waitFor({ timeout: 90000 }); await wait(3000);
  log('text', (await txt()).slice(0, 700));
  for (const t of ['5★', '1★', 'All']) { await page.getByRole('tab', { name: t }).first().click(); await wait(1200); log('tab ' + t, (await page.locator('main tbody').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)); }
});
await run('reports', async () => {
  await page.goto('/reports'); await page.getByRole('heading', { name: 'Reports' }).waitFor({ timeout: 90000 }); await wait(3000);
  log('text', (await txt()).slice(0, 1200));
  await main().getByRole('button', { name: 'Build a report' }).click(); await wait(3000); log('build ->', page.url());
});
await run('playground', async () => {
  await page.goto('/playground'); await page.getByRole('heading', { name: 'Playground' }).waitFor({ timeout: 90000 }); await wait(3000);
  log('text', (await txt()).slice(0, 1500));
  await main().getByRole('button', { name: 'New report' }).first().click(); await wait(3000);
  log('new ->', page.url() + ' ' + (await txt()).slice(0, 900));
  await page.screenshot({ path: `${DIR}/playground-new.png`, fullPage: true });
});
await run('dashboard', async () => {
  await page.goto('/dashboard'); await page.getByRole('heading', { name: /^Good / }).waitFor({ timeout: 90000 }); await wait(4000);
  log('tabs', clean(await page.getByRole('tab').allInnerTexts()));
  log('text', (await txt()).slice(0, 1500));
  for (const t of ['Sales', 'Partners', 'Contracts', 'Allotments', 'Look-to-book', 'Quotations', 'Enquiries', 'Feedback']) { const tb = page.getByRole('tab', { name: t, exact: true }).first(); if (!(await tb.count())) continue; await tb.click(); await wait(2500); log('tab ' + t, (await txt()).slice(0, 400)); }
  for (const b of ['Search products', 'New reservation', 'New quote']) { await page.goto('/dashboard'); await page.getByRole('heading', { name: /^Good / }).waitFor({ timeout: 90000 }); await wait(2000); await main().getByRole('button', { name: b, exact: true }).first().click(); await wait(3000); log(b + ' ->', page.url()); }
});
log('\nSENT (blocked)', sent);
await browser.close();
