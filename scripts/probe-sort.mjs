// Helper (not a test): READ-ONLY - raw supplier names after sorting by Name (shows leading spaces).
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const b = await chromium.launch(); const ctx = await b.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const page = await ctx.newPage();
let api = null;
page.on('response', async r => { if (/suppliers(\?|$)/.test(r.url()) && r.request().method() === 'GET') { try { api = await r.json(); } catch {} } });
await page.goto('/suppliers'); await page.getByRole('heading', { name: /^Suppliers/ }).first().waitFor({ timeout: 90000 }); await page.waitForTimeout(4000);
await page.getByRole('columnheader', { name: /^Name/ }).locator('span, div').filter({ hasText: /^Name$/ }).first().click(); await page.waitForTimeout(2500);
const raw = await page.locator('main tbody tr:visible td:first-child').evaluateAll(els => els.slice(0, 5).map(e => JSON.stringify(e.textContent)));
console.log('first rows (raw):', raw.join(' | '));
const list = Array.isArray(api) ? api : (api?.items ?? api?.data ?? []);
console.log('API names with leading/trailing spaces:', JSON.stringify(list.map(x => x.supplierName ?? x.name).filter(n => n && n !== n.trim())));
await b.close();
