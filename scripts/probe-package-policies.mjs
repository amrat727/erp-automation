// Helper (not a test): READ-ONLY - Package 1, Policies tab on v1.0.2: which "Edit" buttons exist and where each goes.
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? '.';
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => { const q = r.request(); if (['POST','PUT','DELETE','PATCH'].includes(q.method()) && !/negotiate|\/auth\//.test(q.url())) return r.abort(); return r.continue(); });
const page = await ctx.newPage();
await page.goto('/packages/1');
await page.getByRole('tab', { name: /^Policies/ }).click({ timeout: 90000 });
await page.waitForTimeout(2500);
const edits = page.getByRole('button', { name: /edit/i });
console.log('edit-like buttons:', await edits.count());
for (let i = 0; i < await edits.count(); i++) {
  const b = edits.nth(i);
  console.log(i, JSON.stringify(await b.evaluate(e => ({ text: e.innerText, aria: e.getAttribute('aria-label'), visible: !!e.offsetParent, ctx: (e.closest('section,.MuiCard-root,.MuiPaper-root,[role=tabpanel]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }))));
}
console.log('tabpanel:', (await page.locator('[role=tabpanel]:visible').first().innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 600));
await page.screenshot({ path: DIR + '/package-policies-v102.png' });
await browser.close();
