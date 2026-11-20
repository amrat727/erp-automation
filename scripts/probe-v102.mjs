// Helper (not a test): READ-ONLY look at every Core master screen on the current build (all writes blocked):
// Name max length, characters kept, empty-search text, sort order, Columns menu, switch labels.
// Run: node scripts/probe-v102.mjs [screen-path ...]
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route(`**/${process.env.API_HOST ?? 'pilottest.runasp.net'}/**`, r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) return r.abort();
  return r.continue();
});
const page = await ctx.newPage();
const SCREENS = process.argv.slice(2).length ? process.argv.slice(2) : [
  '/chartofaccounts', '/accountgroup', '/tax', '/exchangetypes', '/currency', '/contacttype', '/languages', '/themes', '/status',
  '/organization/branches', '/organization/departments', '/producttype', '/productclass', '/roomtypes', '/viewtypes', '/roomcategories',
  '/supplements', '/allotments', '/addons', '/amenities', '/countries', '/states', '/cities', '/markets', '/desk-locations', '/landmarks',
  '/provinces', '/airports', '/resourcetypes', '/resources/personnel', '/resources/assets'];
const clean = a => a.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
for (const path of SCREENS) {
  const out = { path };
  try {
    await page.goto(path);
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    out.heading = clean(await page.locator('main h1, main h4, main h5, main h6').allInnerTexts()).slice(0, 2);
    out.toolbar = clean(await page.locator('main button:visible').allInnerTexts()).filter(t => t.length < 30).slice(0, 8);
    out.switchLabels = [...new Set(await page.locator('tbody input[type=checkbox]').evaluateAll(els => els.map(e => `${e.checked ? 'on' : 'off'}=${e.getAttribute('aria-label')}`)))];
    // sort by Name
    const nameHdr = page.getByRole('columnheader', { name: /^Name/ }).getByRole('button', { name: 'Name' });
    if (await nameHdr.count()) {
      const idx = await page.locator('thead th').evaluateAll(ths => ths.findIndex(t => /^Name/.test((t.textContent || '').trim())) + 1);
      const names = () => page.locator(`tbody tr td:nth-child(${idx})`).allInnerTexts().then(clean);
      await nameHdr.click(); await page.waitForTimeout(2000); out.asc = (await names()).slice(0, 12);
      await nameHdr.click(); await page.waitForTimeout(2000); out.desc = (await names()).slice(0, 12);
      await page.reload(); await page.waitForTimeout(2500);
    }
    // columns menu
    const cols = page.getByRole('button', { name: 'Columns' });
    if (await cols.count()) {
      await cols.first().click(); await page.waitForTimeout(800);
      out.columnsMenu = clean(await page.locator('[role=presentation]:visible').last().innerText().then(t => t.split('\n')));
      await page.keyboard.press('Escape');
    }
    // empty search
    const search = page.locator('thead input[placeholder=Search]').first();
    if (await search.count()) {
      await search.fill('zzzqqq'); await page.waitForTimeout(2500);
      out.empty = clean(await page.locator('tbody').innerText().then(t => [t]));
      await search.fill(''); await page.waitForTimeout(1500);
    }
    // add dialog name field
    const add = page.locator('main button:visible', { hasText: /^Add / }).first();
    if (await add.count()) {
      await add.click(); await page.waitForTimeout(1200);
      const dlg = page.locator('.MuiDialog-paper:visible').last();
      const box = dlg.getByText(/^Name\s*\*?$/).first().locator('xpath=following::input[1]');
      if (await box.count()) {
        out.maxlength = await box.getAttribute('maxlength');
        await box.fill('A'.repeat(300)); out.len300 = (await box.inputValue()).length;
        await box.fill(''); await box.pressSequentially('Zone 2 North-1 & Co (Test), A.B/C\'s', { delay: 5 }); out.typed = await box.inputValue();
      }
      await page.keyboard.press('Escape');
    }
  } catch (e) { out.error = e.message.split('\n')[0]; }
  console.log(JSON.stringify(out));
}
await browser.close();
