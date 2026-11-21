// Helper (not a test): READ-ONLY - which fields each Asset Type makes required in Add Asset (writes blocked).
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route(`**/${process.env.API_HOST ?? 'pilottest.runasp.net'}/**`, r =>
  ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
await page.goto('/resources/assets');
await page.getByRole('button', { name: 'Add Asset' }).click({ timeout: 60_000 });
const dlg = page.locator('.MuiDialog-paper:visible').last();
const type = dlg.getByRole('combobox', { name: 'Asset Type' });
await type.click();
const types = await page.getByRole('option').allInnerTexts();
console.log('types:', types);
await page.keyboard.press('Escape');
for (const t of types) {
  await type.click(); await page.getByRole('option', { name: t, exact: true }).click(); await page.waitForTimeout(800);
  const req = (await dlg.locator('p, label, span').allInnerTexts()).map(s => s.trim()).filter(s => /\*$/.test(s));
  let cats = [];
  const cat = dlg.getByRole('combobox', { name: 'Category' });
  if (await cat.count()) { await cat.click(); cats = await page.getByRole('option').allInnerTexts(); await page.keyboard.press('Escape'); }
  console.log(`${t}: required ${JSON.stringify([...new Set(req)])} categories ${JSON.stringify(cats.slice(0, 6))}`);
}
await browser.close();
