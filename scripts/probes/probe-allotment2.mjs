// Helper (not a test): READ-ONLY - open the saved test allotment and compare the room shown in the list with the room inside it.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-allotment2';
const NAME = process.argv[3] ?? 'QA Auto Allotment';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) return r.abort();
  return r.continue();
});
const page = await ctx.newPage();
const gets = [];
page.on('response', async r => { if (/allotment|rooms|products/i.test(r.url()) && r.request().method() === 'GET') { try { gets.push(`${r.url()}\n${(await r.text()).slice(0, 1500)}`); } catch {} } });
await page.goto('/suppliers/18/products');
await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.waitForTimeout(3500);
await page.getByRole('tab', { name: 'Allotment', exact: true }).last().click();
await page.waitForTimeout(4000);
const row = page.locator('main table:visible').last().locator('tbody tr', { hasText: NAME }).first();
console.log('LIST ROW:', (await row.innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: `${DIR}/1-list.png` });
await row.locator('td').first().click();
await page.waitForTimeout(4000);
console.log('CHIPS INSIDE:', (await page.locator('main .MuiChip-label:visible').allInnerTexts()).join(' | '));
await page.screenshot({ path: `${DIR}/2-open.png` });
console.log('GETS:\n' + gets.filter(g => /allotment/i.test(g)).join('\n\n').slice(0, 5000));
await browser.close();
