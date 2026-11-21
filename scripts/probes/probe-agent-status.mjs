// Helper (not a test): READ-ONLY - status of each "QA Auto Agent" in the Agent list.
import { chromium } from '@playwright/test';
import fs from 'fs';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST','PUT','DELETE','PATCH'].includes(r.request().method()) && !/negotiate|auth/.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
await page.goto('/agents'); await page.locator('main tbody tr').first().waitFor({ timeout: 90000 });
await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('QA Auto Agent'); await page.waitForTimeout(4000);
for (const r of await page.locator('main tbody tr:visible').allInnerTexts()) console.log(r.replace(/\s+/g, ' '));
await browser.close();
