// Helper (not a test): READ-ONLY - what the Add allotment form sends after picking Club and 5 units. Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-allotment';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}\n${r.request().postData()}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const btn = name => page.getByRole('button', { name, exact: true }).last();
await page.goto('/suppliers/18/products');
await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.waitForTimeout(3500);
await page.getByRole('tab', { name: 'Allotment', exact: true }).last().click();
await page.waitForTimeout(3000);
await btn('Add allotment').click();
await page.waitForTimeout(2500);
await page.getByPlaceholder('Enter an allotment name').fill('QA Probe Allotment');
const rooms = page.getByPlaceholder('All room categories').first();
await rooms.click();
await page.waitForTimeout(800);
console.log('options:', (await page.getByRole('option').allInnerTexts()).join(' | '));
await page.getByRole('option', { name: 'Club', exact: true }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
console.log('rooms chips:', (await page.locator('main .MuiChip-label:visible').allInnerTexts()).join(' | '));
await page.screenshot({ path: `${DIR}/1-after-club.png` });
await btn('Add block').click();
await page.waitForTimeout(800);
const units = page.locator('main table:visible').last().locator('tbody tr').first().locator('input[type=number]').first();
await units.click(); await units.press('Control+A'); await units.pressSequentially('5'); await units.press('Tab');
console.log('units value:', await units.inputValue());
await page.screenshot({ path: `${DIR}/2-block.png` });
await btn('Save').click();
await page.waitForTimeout(3000);
console.log('problems:', await page.getByText(/problems? to fix/).last().innerText().catch(() => 'none'));
console.log('SENT:\n' + sent.join('\n\n'));
await browser.close();
