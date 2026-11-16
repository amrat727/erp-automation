// Helper (not a test): READ-ONLY look at Agent Add form, detail page and Credit Requests (all saves blocked).
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'agent-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const m = r.request().method(); if (['POST','PUT','DELETE','PATCH'].includes(m) && !r.request().url().includes('negotiate')) { sent.push(`${m} ${r.request().url()}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
let n = 0;
const dump = async label => {
  await page.waitForTimeout(3500);
  console.log(`\n=== ${label}  ${new URL(page.url()).pathname}`);
  console.log('headings:', JSON.stringify(await page.getByRole('heading').allInnerTexts()));
  console.log('tabs:', JSON.stringify(await page.getByRole('tab').allInnerTexts()));
  console.log('buttons:', JSON.stringify([...new Set((await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))]));
  console.log('inputs:', JSON.stringify(await page.locator('main input:visible, main textarea:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder, x.getAttribute('role'), x.disabled ? 'disabled' : '', x.maxLength > 0 ? 'max' + x.maxLength : '', (x.value || '').slice(0, 25)].filter(Boolean).join('|')))));
  console.log('labels:', JSON.stringify((await page.locator('main label:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim())));
  console.log('dialogs:', JSON.stringify((await page.getByRole('dialog').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 500))));
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true });
};
await page.goto('/agents');
await page.getByRole('heading', { name: 'Agents' }).waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Credit Requests' }).click(); await dump('credit requests');
await page.keyboard.press('Escape');
await page.goto('/agents'); await page.getByRole('heading', { name: 'Agents' }).waitFor({ timeout: 90_000 }); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Columns' }).click(); await dump('columns menu');
console.log('menuitems:', JSON.stringify(await page.getByRole('menuitem').allInnerTexts()));
await page.keyboard.press('Escape');
await page.getByRole('columnheader', { name: /Status/ }).getByRole('combobox').click(); await page.waitForTimeout(1200);
console.log('status options:', JSON.stringify(await page.getByRole('option').allInnerTexts())); await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Add Agent' }).click(); await dump('add agent');
await page.keyboard.press('Escape');
await page.goto('/agents'); await page.getByRole('heading', { name: 'Agents' }).waitFor({ timeout: 90_000 }); await page.waitForTimeout(2500);
await page.locator('main tbody tr:visible').filter({ hasText: 'AG-00002' }).locator('td').first().click(); await dump('agent detail AG-00002');
for (const t of await page.getByRole('tab').allInnerTexts()) {
  if (/^Agents$/.test(t.trim())) continue;
  await page.getByRole('tab', { name: t.trim(), exact: true }).last().click().catch(() => {}); await dump('tab ' + t.trim());
}
console.log('\nWRITES SENT:', sent);
await browser.close();
