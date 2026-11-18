// Helper (not a test): for each list screen, records how it looks and behaves so tests can be written.
// All save/update/delete requests are BLOCKED - nothing in the ERP changes.
// Run:  node scripts/probe-screens.mjs out.json
import { chromium } from '@playwright/test';
import fs from 'fs';

const SCREENS = [
  ['Currency', '/currency'], ['Role', '/contacttype'], ['Language', '/languages'], ['Theme', '/themes'],
  ['Question', '/feedback-questions'], ['Status', '/status'],
  ['Resource Type', '/resourcetypes'], ['Personnel', '/resources/personnel'], ['Asset', '/resources/assets'], ['Mapping', '/resourcemapping'],
  ['Branch', '/organization/branches'], ['Department', '/organization/departments'],
  ['Account', '/chartofaccounts'], ['Account Group', '/accountgroup'], ['Tax', '/tax'], ['Tax Detail', '/taxdetail'],
  ['Exchange Type', '/exchangetypes'], ['Exchange Rate', '/exchangerates'],
  ['Group', '/restrictions'], ['User', '/users'],
];
const only = process.argv[3] ? process.argv[3].split(',') : null;

const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com' });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !r.request().url().includes('negotiate') ? r.abort() : r.continue());
const out = [];
const txt = async l => (await l.count()) ? (await l.first().innerText()).trim() : null;

for (const [entity, path] of SCREENS) {
  if (only && !only.includes(entity)) continue;
  const page = await ctx.newPage();
  const info = { entity, path };
  try {
    await page.goto(path);
    await page.getByRole('heading').filter({ hasNotText: /^Good / }).first().waitFor({ timeout: 60_000 });
    await page.locator('tbody tr').first().or(page.getByText(/no records|yet\.|no .* found/i).first()).waitFor({ timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    info.heading = await txt(page.getByRole('heading').filter({ hasNotText: /^Good / }));
    info.toolbar = (await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 15);
    info.headers = (await page.locator('thead th').allInnerTexts()).map(s => s.trim().replace(/\s+/g, ' '));
    info.searchPlaceholders = await page.locator('thead input').evaluateAll(e => e.map(x => x.getAttribute('placeholder')));
    info.firstRows = (await page.locator('tbody tr').allInnerTexts()).slice(0, 3).map(s => s.replace(/\s+/g, ' | ').slice(0, 160));
    info.range = await txt(page.getByText(/^\d+–\d+ of [\d,]+$/));
    // filter options
    const filter = page.getByRole('columnheader', { name: /Active/ }).getByRole('combobox');
    if (await filter.count()) { await filter.first().click(); info.filterOptions = await page.getByRole('option').allInnerTexts(); await page.keyboard.press('Escape'); }
    // empty search
    const search = page.locator('thead input[type=text], thead input:not([type])').first();
    if (await search.count()) { await search.fill('zzzqqq'); await page.waitForTimeout(3000); info.emptyText = (await page.locator('tbody').innerText()).trim().slice(0, 120); await search.fill(''); await page.waitForTimeout(2000); }
    // deactivate popup on the first ACTIVE row
    const sw = page.locator('tbody tr input[type=checkbox]:checked').first();
    if (await sw.count()) {
      await sw.click(); await page.waitForTimeout(800);
      info.popupTitle = await txt(page.locator('.swal2-title')); info.popupText = await txt(page.locator('.swal2-html-container'));
      info.popupButtons = await page.locator('.swal2-popup button:visible').allInnerTexts();
      const c = page.locator('.swal2-popup').getByRole('button', { name: 'Cancel' }); if (await c.count()) await c.click();
    }
    // row click -> edit?
    const firstCell = page.locator('tbody tr td').first();
    if (await page.locator('tbody tr input[type=checkbox]').count()) {
      await firstCell.click(); await page.waitForTimeout(1500);
      info.rowClickDialog = await txt(page.getByRole('dialog').locator('h2, h3, [class*=title]'));
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    }
    // add dialog
    const add = page.locator('main').getByRole('button', { name: /^(Add|New|Enter|Raise)/ }).first();
    if (await add.count()) {
      info.addButton = (await add.innerText()).trim();
      await add.click(); await page.waitForTimeout(1500);
      const dlg = page.getByRole('dialog').last();
      if (await dlg.count()) {
        info.dialogTitle = await txt(dlg.locator('h2, h3, [class*=title]'));
        info.labels = (await dlg.locator('label, .MuiFormLabel-root, [class*=label]').allInnerTexts()).map(s => s.trim()).filter(Boolean);
        info.inputs = await dlg.locator('input, textarea, select').evaluateAll(e => e.map(x => `${x.tagName.toLowerCase()}[${x.type}] ${x.getAttribute('placeholder') ?? ''} ${x.getAttribute('maxlength') ? 'max=' + x.getAttribute('maxlength') : ''} ${x.getAttribute('role') ?? ''}`.trim()));
        info.dialogButtons = (await dlg.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean);
        const save = dlg.getByRole('button', { name: /^(Save|Create|Submit)/ }).first();
        if (await save.count()) {
          await save.click(); await page.waitForTimeout(1500);
          info.emptySaveErrors = (await dlg.locator('.Mui-error, [class*=error], [role=alert], .text-red-500, .text-danger').allInnerTexts()).map(s => s.trim()).filter(Boolean);
          info.emptySaveBanner = (await page.locator('[role=alert], .MuiAlert-message, .Toastify__toast').allInnerTexts()).map(s => s.trim()).filter(Boolean);
        }
      } else info.addOpens = new URL(page.url()).pathname;
    }
  } catch (e) { info.error = String(e).slice(0, 200); }
  out.push(info);
  console.log(JSON.stringify(info));
  await page.close();
}
fs.writeFileSync(process.argv[2] || 'probe.json', JSON.stringify(out, null, 2));
await browser.close();
