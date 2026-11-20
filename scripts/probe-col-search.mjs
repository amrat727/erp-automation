// Helper (not a test): READ-ONLY - how the column filters behave in a list header (writes blocked).
// Run: node scripts/probe-col-search.mjs /countries
import { chromium } from '@playwright/test';
import fs from 'fs';
const path = process.argv[2] ?? '/countries';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route(`**/${process.env.API_HOST ?? 'pilottest.runasp.net'}/**`, r =>
  ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
const clean = h => h.replace(/ class="[^"]*"/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').replace(/<fieldset[\s\S]*?<\/fieldset>/g, '');
const headers = async label => {
  console.log(`--- ${label}`);
  for (const th of await page.locator('thead th').all()) {
    const aria = await th.evaluate(e => [...e.querySelectorAll('[aria-label],[role=button],[role=combobox],input')].map(x => `${x.tagName}${x.getAttribute('role') ? '[' + x.getAttribute('role') + ']' : ''}:${x.getAttribute('aria-label') || x.getAttribute('placeholder') || x.textContent.trim()}${x.checkVisibility() ? '' : '(hidden)'}`).join(' | '));
    console.log('  th:', aria.slice(0, 400));
  }
};
await page.goto(path);
await page.locator('tbody tr').first().waitFor({ timeout: 60_000 });
const act = page.locator('thead th:has([aria-label="Clear Active filter"])');
await act.locator('span[aria-hidden=true]').first().click({ force: true });
await page.waitForTimeout(1200);
console.log('after reveal: listbox open', await page.getByRole('listbox').isVisible(), '| combobox visible', await act.locator('[role=combobox]').isVisible());
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
console.log('after Escape: listbox open', await page.getByRole('listbox').isVisible(), '| combobox visible', await act.locator('[role=combobox]').isVisible(), '| role-found', await act.getByRole('combobox').count());
await act.locator('[role=combobox]').click(); await page.waitForTimeout(800);
await page.getByRole('option', { name: 'Active', exact: true }).click(); await page.waitForTimeout(1500);
console.log('after choosing Active: combobox visible', await act.locator('[role=combobox]').isVisible(), '| text', await act.locator('[role=combobox]').innerText().catch(() => '-'), '| chip', await act.locator('[aria-label*="change filter"]').getAttribute('aria-label'));
await browser.close();
