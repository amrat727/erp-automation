// Helper (not a test): READ-ONLY deep look at the Package module (list, Bundles tab, Add New, a package's tabs). All saves blocked.
// Run: node scripts/probe-package.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'package-probe';
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
const dump = async tag => {
  log('url', page.url());
  log('headings', clean(await page.getByRole('heading').allInnerTexts()).slice(0, 10));
  log('tabs', clean(await page.getByRole('tab').allInnerTexts()));
  log('buttons', clean(await main().getByRole('button').allInnerTexts()).slice(0, 40));
  log('labels', clean(await main().locator('label:visible, .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 50));
  log('inputs', (await main().locator('input:visible, textarea:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder || x.getAttribute('aria-label') || '', x.value].join('|')))).slice(0, 40));
  log('text', (await main().innerText()).replace(/\s+/g, ' ').slice(0, 1200));
  await page.screenshot({ path: `${DIR}/${tag}.png`, fullPage: true });
};
const list = async () => { await page.goto('/packages'); await page.locator('main tbody tr').first().waitFor({ timeout: 90_000 }); await wait(2500); };

await run('list', async () => {
  await list(); await dump('package-list');
  log('row switches', await page.locator('main tbody tr:visible input[type=checkbox]').evaluateAll(e => e.map(x => (x.getAttribute('aria-label') || '?') + '=' + x.checked)));
  const combos = page.locator('main thead [role=combobox]:visible');
  for (let i = 0; i < await combos.count(); i++) { await combos.nth(i).click(); await wait(800); log('header combo ' + i, clean(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape'); await wait(300); }
});
await run('published switch', async () => {
  await list();
  const pub = page.locator('main tbody tr:visible input[type=checkbox]').first();
  log('first switch label', await pub.getAttribute('aria-label'));
  await pub.click(); await wait(1500);
  log('popup', clean(await page.locator('.swal2-popup:visible, .MuiDialog-paper:visible').allInnerTexts()));
  const cancel = page.locator('.swal2-popup:visible, .MuiDialog-paper:visible').getByRole('button', { name: 'Cancel' });
  if (await cancel.count()) await cancel.first().click();
});
await run('bundles tab', async () => {
  await list();
  await page.getByRole('tab', { name: 'Bundles' }).click(); await wait(3000); await dump('package-bundles');
});
await run('add new', async () => {
  await list();
  await main().getByRole('button', { name: 'Add New' }).click(); await wait(5000); await dump('package-add');
  const save = main().getByRole('button', { name: /^(Save|Create|Next|Continue|Publish)/ }).last();
  log('save button', await save.count() ? await save.innerText() : 'none');
  if (await save.count()) {
    await save.click(); await wait(3000);
    log('empty-save messages', clean(await main().locator('.MuiFormHelperText-root:visible, .Mui-error:visible').allInnerTexts()));
    log('empty-save banner', clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible, .swal2-popup:visible').allInnerTexts()));
    await page.screenshot({ path: `${DIR}/package-add-empty-save.png`, fullPage: true });
  }
});
await run('open package', async () => {
  await list();
  await page.locator('main tbody tr:visible').first().locator('td').first().click(); await wait(5000); await dump('package-detail');
  for (const t of ['Services', 'Highlights', 'Policies', 'Basic details', 'Agent booking', 'Images', 'Description']) {
    const tab = page.getByRole('tab', { name: new RegExp('^' + t) }).first();
    if (!(await tab.count())) { log('tab ' + t, 'missing'); continue; }
    await tab.click(); await wait(2500);
    log('tab ' + t, (await main().innerText()).replace(/\s+/g, ' ').slice(0, 500));
  }
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click().catch(() => {}); await wait(3000);
  log('after Edit url', page.url());
  log('after Edit buttons', clean(await main().getByRole('button').allInnerTexts()).slice(-15));
  await page.screenshot({ path: `${DIR}/package-edit.png`, fullPage: true });
});
log('\nSENT (blocked)', sent);
await browser.close();
