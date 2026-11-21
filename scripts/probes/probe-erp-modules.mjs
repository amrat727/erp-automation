// Helper (not a test): READ-ONLY deep first look at every module not covered yet (all saves blocked).
// For each screen: list facts, the Add/New form (labels, required, empty-save errors), the first record's detail page.
// Run: node scripts/probes/probe-erp-modules.mjs <outDir> [screenFilter]
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'erp-probe';
const ONLY = process.argv[3];
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const m = r.request().method(); if (['POST','PUT','DELETE','PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const clean = a => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const slug = s => s.replace(/[^A-Za-z0-9]+/g, '-');
const nav = () => page.locator('nav, aside').first();

async function facts(tag) {
  log('  url', page.url());
  log('  headings', clean(await page.getByRole('heading').allInnerTexts()).slice(0, 8));
  log('  buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 40));
  log('  tabs', clean(await page.getByRole('tab').allInnerTexts()));
  log('  headers', clean(await page.locator('main th:visible').allInnerTexts()));
  log('  inputs', (await page.locator('main input:visible, main textarea:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder || x.getAttribute('aria-label') || '', x.value].join('|')))).slice(0, 30));
  log('  labels', clean(await page.locator('main label:visible, main .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 40));
  log('  rows', (await page.locator('main tbody tr:visible').count()) + ' ' + JSON.stringify(clean((await page.locator('main tbody tr:visible').allInnerTexts()).slice(0, 3)).map(s => s.slice(0, 160))));
  log('  text', (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 900));
  await page.screenshot({ path: `${DIR}/${tag}.png`, fullPage: true });
}

async function screen(tag, openFn) {
  if (ONLY && !tag.toLowerCase().includes(ONLY.toLowerCase())) return;
  console.log(`\n===== ${tag}`);
  try {
    await openFn(); await wait(5000);
    await facts(slug(tag) + '-list');
    // add / new
    const add = page.locator('main').getByRole('button', { name: /^(\+\s*)?(Add|New|Create|Build)\b/i }).locator('visible=true').first();
    if (await add.count()) {
      const label = (await add.innerText()).trim();
      console.log(`  --- form via "${label}"`);
      await add.click(); await wait(4000);
      const dlg = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible, .MuiDrawer-anchorBottom .MuiDrawer-paper:visible').last();
      const isDlg = await dlg.isVisible().catch(() => false);
      log('  opens as', isDlg ? 'dialog/drawer' : 'page ' + page.url());
      const scope = isDlg ? dlg : page.locator('main');
      log('  form labels', clean(await scope.locator('label:visible, .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 50));
      log('  form inputs', (await scope.locator('input:visible, textarea:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder || x.getAttribute('aria-label') || ''].join('|')))).slice(0, 40));
      log('  form buttons', clean(await scope.getByRole('button').allInnerTexts()).slice(-15));
      await page.screenshot({ path: `${DIR}/${slug(tag)}-form.png`, fullPage: true });
      const save = scope.getByRole('button', { name: /^(Save|Create|Add|Submit|Continue|Next)\b/ }).locator('visible=true').last();
      if (await save.count() && await save.isEnabled().catch(() => false)) {
        const before = sent.length;
        await save.click().catch(() => {}); await wait(3000);
        log('  empty-save inline', clean(await page.locator('.MuiFormHelperText-root.Mui-error:visible, p.Mui-error:visible').allInnerTexts()));
        log('  empty-save banner', clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible, .swal2-popup:visible').allInnerTexts()));
        log('  empty-save red', await page.locator('.MuiInputBase-root.Mui-error:visible').count());
        log('  empty-save sent', sent.slice(before));
        await page.screenshot({ path: `${DIR}/${slug(tag)}-form-empty-save.png`, fullPage: true });
      } else log('  save', 'none / disabled');
      await page.keyboard.press('Escape'); await wait(800);
    } else log('  add', 'none');
    // first record
    await openFn(); await wait(5000);
    const row = page.locator('main tbody tr:visible').first();
    if (await row.count() && !(await row.innerText()).match(/no records|No open/i)) {
      await row.locator('td').nth(1).click().catch(() => row.click()); await wait(5000);
      console.log('  --- first record');
      await facts(slug(tag) + '-record');
    }
  } catch (e) { console.log('!! ' + e.message.split('\n')[0]); }
}

const viaNav = (...chain) => async () => {
  await page.goto('/dashboard'); await nav().getByRole('button').first().waitFor({ timeout: 90_000 }); await wait(1500);
  for (const c of chain) { await nav().getByRole('button', { name: c, exact: true }).first().click(); await wait(1200); }
};
const go = path => async () => { await page.goto(path); };

await screen('Dashboard', go('/dashboard'));
await screen('Company', viaNav('Company'));
await screen('Product Search', viaNav('Product Search'));
await screen('Contracts', viaNav('Contracts'));
await screen('Package', viaNav('Package'));
await screen('Enquiries', viaNav('Enquiries'));
await screen('Quotes', viaNav('Quotes'));
await screen('Reservation', viaNav('Reservation'));
await screen('Amendment Requests', viaNav('Amendment Requests'));
await screen('Feedback', viaNav('Feedback'));
await screen('Playground', viaNav('Playground'));
await screen('Reports', viaNav('Reports'));
for (const s of ['Overview', 'Sponsored Offers', 'Deal Cards', 'Login Slider', 'Listing Layout', 'Package Options', 'Documents', 'Checkout Fields', 'Email Templates', 'Scheduler', 'Storefront'])
  await screen('Portal CMS ' + s, viaNav('Portal CMS', s));
log('\nSENT (all blocked)', sent.length);
await browser.close();
