// Helper (not a test): prints suppliers whose name contains the given text, with code and status. READ-ONLY.
// Run:  node scripts/list-suppliers.mjs "QA Auto Supplier"
import { chromium } from '@playwright/test';
import fs from 'fs';

const q = process.argv[2] ?? 'QA Auto Supplier';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com' });
await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await page.route('**/pilottest.runasp.net/**', r => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !r.request().url().includes('negotiate') ? r.abort() : r.continue());
await page.goto('/suppliers');
await page.getByRole('heading', { name: /^Suppliers/ }).waitFor({ timeout: 90_000 });
await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill(q);
await page.waitForTimeout(6000);
for (const r of await page.locator('main tbody tr:visible').allInnerTexts()) console.log(r.replace(/\s*\n\s*|\t/g, ' | '));
await browser.close();
