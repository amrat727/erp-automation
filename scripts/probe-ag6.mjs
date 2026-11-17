// Helper (not a test): READ-ONLY summary of agent AG-00006 (the B2B test agent). Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const b = await chromium.launch(); const ctx = await b.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST','PUT','DELETE','PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
const clean = s => s.replace(/\s+/g, ' ').trim();
await page.goto('/agents'); await page.getByRole('heading', { name: 'Agents' }).first().waitFor({ timeout: 90000 }); await page.waitForTimeout(3000);
await page.locator('main tbody tr:visible', { hasText: 'AG-00006' }).first().locator('td').first().click();
await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(3000);
const base = page.url().replace(/\/overview.*/, '');
for (const t of ['overview', 'financials', 'access']) {
  await page.goto(`${base}/${t}`); await page.waitForTimeout(4500);
  const txt = clean(await page.locator('main').innerText()).replace(/^.*?Agents.*?Page \d+ of \d+/, '');
  console.log(`\n=== ${t}: ${txt.slice(0, 1600)}`);
  await page.screenshot({ path: process.argv[2] + `/ag6-${t}.png`, fullPage: true });
}
await b.close();
