// Helper (not a test): READ-ONLY - the v1.0.2 user record page (writes blocked): what Edit does, where "Reports To" is.
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route(`**/${process.env.API_HOST ?? 'pilottest.runasp.net'}/**`, r =>
  ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
const fields = async () => (await page.locator('main').getByRole('textbox').or(page.locator('main').getByRole('combobox')).evaluateAll(els =>
  els.map(e => `${e.getAttribute('aria-label') || e.closest('div')?.parentElement?.querySelector('label,p')?.textContent || '?'}${e.disabled ? '(off)' : ''}`)));
await page.goto('/users');
await page.getByRole('cell', { name: 'sahil', exact: true }).click({ timeout: 60_000 });
await page.getByRole('tab', { name: 'Overview' }).waitFor({ timeout: 30_000 });
console.log('url', page.url());
for (const tab of ['Overview', 'Security']) {
  await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(1500);
  console.log(tab, 'fields:', JSON.stringify(await fields()));
  console.log(tab, 'buttons:', JSON.stringify((await page.locator('main button:visible').allInnerTexts()).map(t => t.trim()).filter(Boolean).slice(0, 12)));
}
await page.getByRole('tab', { name: 'Security' }).click(); await page.waitForTimeout(1000);
const edits = page.locator('main').getByRole('button', { name: 'Edit', exact: true });
console.log('Edit buttons:', await edits.count());
await edits.last().click(); await page.waitForTimeout(4000);
await page.screenshot({ path: 'test-results/probe-user-edit.png' });
console.log('buttons after Edit:', JSON.stringify((await page.locator('main button:visible').allInnerTexts()).map(t => t.trim()).filter(Boolean).slice(0, 14)));
console.log('after Edit: dialogs', await page.locator('[role=dialog]:visible h2').allInnerTexts());
for (const tab of ['Overview', 'Security']) {
  if (await page.getByRole('tab', { name: tab }).isVisible()) { await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(1000); }
  console.log('edit', tab, 'fields:', JSON.stringify(await fields()));
}
console.log('Reports To visible:', await page.getByText(/^Reports To/).count());
await browser.close();
