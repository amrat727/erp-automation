// Helper (not a test): Roll over PREVIEW for a 250 % price change on an INACTIVE "QA Auto" contract.
// Only the request with "preview": true is allowed through (it calculates, it does not save); every other write is blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => { const q = r.request(); const body = q.postData() || '';
  if (['POST','PUT','DELETE','PATCH'].includes(q.method()) && !/negotiate|\/auth\//.test(q.url())) {
    if (/contracts\/bulk/.test(q.url()) && /"preview":true/.test(body)) { console.log('ALLOWED preview', body); return r.continue(); }
    console.log('BLOCKED', q.method(), q.url(), body.slice(0, 300)); return r.abort(); }
  return r.continue(); });
const page = await ctx.newPage();
page.on('response', async r => { if (/contracts\/bulk/.test(r.url())) console.log('RESPONSE', r.status(), (await r.text().catch(() => '')).slice(0, 800)); });
await page.goto('/contracts'); await page.locator('main tbody tr').first().waitFor({ timeout: 90000 }); await page.waitForTimeout(2000);
await page.locator('main [role=combobox]:visible', { hasText: /^Active$/ }).click(); await page.getByRole('option', { name: 'Inactive', exact: true }).click(); await page.waitForTimeout(3000);
const row = page.locator('main tbody tr:visible', { hasText: /^\s*QA Auto/ }).first();
console.log('ROW', (await row.innerText()).replace(/\s+/g, ' '));
await row.locator('input[type=checkbox]').check();
await page.locator('main').getByRole('button', { name: 'Roll over', exact: true }).click(); await page.waitForTimeout(2000);
const d = page.locator('.MuiDialog-paper:visible').last();
await d.locator('input[type=number], input[inputmode=decimal], input[inputmode=numeric]').first().fill('250');
await d.getByRole('button', { name: 'Preview' }).click(); await page.waitForTimeout(5000);
console.log('DIALOG', (await d.innerText()).replace(/\s+/g, ' ').slice(0, 900));
console.log('BUTTONS', JSON.stringify(await d.getByRole('button').allInnerTexts()));
await page.screenshot({ path: process.argv[2] + '/rollover-250-preview.png' });
await browser.close();
