// Helper (not a test): READ-ONLY - Package "Add New" > Manual / AI Generated, and "New bundle". All saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'package-probe';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const q = r.request(); if (['POST','PUT','DELETE','PATCH'].includes(q.method()) && !/negotiate|\/auth\//.test(q.url())) { sent.push(`${q.method()} ${q.url()} ${(q.postData() || '').slice(0, 200)}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const clean = a => a.map(s => s.replace(/[\s\u200b]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const run = async (n, f) => { console.log(`\n--- ${n}`); try { await f(); } catch (e) { log('!!', e.message.split('\n')[0]); } await page.keyboard.press('Escape').catch(() => {}); };
const panel = () => page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
const scopeDump = async (s, tag) => {
  log('text', (await s.innerText()).replace(/\s+/g, ' ').slice(0, 1500));
  log('labels', clean(await s.locator('label:visible, .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 50));
  log('inputs', (await s.locator('input:visible, textarea:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder || x.getAttribute('aria-label') || '', x.value].join('|')))).slice(0, 40));
  log('buttons', clean(await s.getByRole('button').allInnerTexts()).slice(-25));
  await page.screenshot({ path: `${DIR}/${tag}.png`, fullPage: true });
};
for (const mode of ['Manual', 'AI Generated']) await run(mode, async () => {
  await page.goto('/packages/new'); await page.getByText(mode, { exact: true }).first().waitFor({ timeout: 90000 }); await wait(1500);
  await page.getByText(mode, { exact: true }).first().click(); await wait(4000);
  log('url', page.url());
  const isPanel = await panel().isVisible().catch(() => false);
  const s = isPanel ? panel() : page.locator('main');
  log('in', isPanel ? 'dialog' : 'page');
  await scopeDump(s, 'package-' + mode.replace(/ /g, ''));
  const next = s.getByRole('button', { name: /^(Next|Continue|Save|Create|Generate|Build)/ }).last();
  if (await next.count()) {
    log('click', await next.innerText()); const before = sent.length;
    await next.click(); await wait(3000);
    log('messages', clean(await s.locator('.MuiFormHelperText-root:visible').allInnerTexts()));
    log('banner', clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible, .swal2-popup:visible').allInnerTexts()));
    log('sent', sent.slice(before));
    await page.screenshot({ path: `${DIR}/package-${mode.replace(/ /g, '')}-empty.png`, fullPage: true });
  }
});
await run('New bundle', async () => {
  await page.goto('/packages'); await page.locator('main tbody tr').first().waitFor({ timeout: 90000 }); await wait(2000);
  await page.getByRole('tab', { name: 'Bundles' }).click(); await wait(2500);
  await page.locator('main').getByRole('button', { name: 'New bundle' }).click(); await wait(4000);
  log('url', page.url());
  const isPanel = await panel().isVisible().catch(() => false);
  const s = isPanel ? panel() : page.locator('main');
  await scopeDump(s, 'package-new-bundle');
  const save = s.getByRole('button', { name: /^(Next|Continue|Save|Create)/ }).last();
  if (await save.count()) { const before = sent.length; await save.click(); await wait(3000);
    log('messages', clean(await s.locator('.MuiFormHelperText-root:visible').allInnerTexts()));
    log('banner', clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible').allInnerTexts()));
    log('sent', sent.slice(before)); }
});
log('\nSENT', sent);
await browser.close();
