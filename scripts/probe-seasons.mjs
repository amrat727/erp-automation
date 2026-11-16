// Helper (not a test): READ-ONLY - season dates of the saved "QA Auto Contract ... overlap" contracts.
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const b = await chromium.launch(); const ctx = await b.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST','PUT','DELETE','PATCH'].includes(r.request().method()) && !/negotiate|\/auth\//.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
page.on('response', async r => { if (/\/contracts\/\d+$/.test(r.url()) && r.request().method() === 'GET') { try { const j = await r.json(); console.log('API seasons/rates:', JSON.stringify((j.rates || []).map(x => [x.fromDate, x.toDate, x.seasonName ?? x.season ?? ''])).slice(0, 800)); } catch {} } });
await page.goto('/suppliers/18/products'); await page.getByText('Choose a product type').waitFor({ timeout: 90000 }); await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click(); await page.waitForTimeout(3500);
await page.getByRole('tab', { name: 'Contract', exact: true }).last().click(); await page.waitForTimeout(3500);
await page.locator('main table:visible').last().locator('tbody tr', { hasText: / overlap/ }).first().locator('td').first().click(); await page.waitForTimeout(5000);
const rows = await page.getByPlaceholder('Enter a season name').evaluateAll(els => els.map(e => { const tr = e.closest('tr'); return [...tr.querySelectorAll('input')].slice(0, 3).map(i => i.value).join(' | '); }));
console.log('SEASONS ON SCREEN:', rows);
await b.close();
