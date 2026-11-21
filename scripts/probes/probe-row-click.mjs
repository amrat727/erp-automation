// Helper (not a test): READ-ONLY - what clicking a row does on a list screen (writes blocked).
// Run: node scripts/probes/probe-row-click.mjs /currency "US Dollar"
import { chromium } from '@playwright/test';
import fs from 'fs';
const [path = '/currency', rowText = 'US Dollar'] = process.argv.slice(2);
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route(`**/${process.env.API_HOST ?? 'pilottest.runasp.net'}/**`, r =>
  ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
await page.goto(path);
const row = page.locator('tbody tr').filter({ hasText: rowText }).first();
await row.waitFor({ timeout: 30_000 });
console.log('header:', (await page.locator('thead tr').first().innerText()).replace(/\s+/g, ' '));
console.log('row:', (await row.innerText()).replace(/\s+/g, ' '), '| buttons:', await row.getByRole('button').count(), '| cursor:', await row.locator('td').first().evaluate(e => getComputedStyle(e).cursor));
console.log('toolbar:', (await page.locator('main button:visible').allInnerTexts()).map(t => t.trim()).filter(Boolean).slice(0, 8));
await row.locator('td').first().click();
await page.waitForTimeout(2000);
console.log('dialogs after click:', await page.locator('.MuiDialog-paper:visible h2, [role=dialog]:visible h2').allInnerTexts(), '| url:', page.url());
await page.screenshot({ path: 'test-results/probe-row-click.png' });
await browser.close();
