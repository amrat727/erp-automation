// Helper: list screens inside nested Core menu groups.  Run: node scripts/discover-nested.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const PATHS = [['Application', 'Flex'], ['Accounts', 'Transactions'], ['Accounts', 'Configuration']];
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: 'https://erp.nexgenpilot.com' });
await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const nav = page.locator('nav, aside').first();
const btns = async () => (await nav.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean);
const open = async (...chain) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Core', exact: true }).click({ timeout: 60_000 });
  for (const c of chain) { await nav.getByRole('button', { name: c, exact: true }).first().click(); await page.waitForTimeout(600); }
};
for (const [g, sub] of PATHS) {
  await open(g);
  const before = await btns();
  await nav.getByRole('button', { name: sub, exact: true }).click(); await page.waitForTimeout(800);
  const items = (await btns()).filter(t => !before.includes(t));
  console.log(g, '>', sub, '=>', JSON.stringify(items));
  for (const item of items) {
    await open(g, sub, item); await page.waitForTimeout(4000);
    const h = (await page.getByRole('heading').allInnerTexts()).map(s => s.trim()).filter(s => s && !/^Good /.test(s));
    const b = (await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 10);
    console.log(JSON.stringify({ g, sub, item, url: new URL(page.url()).pathname, heading: h[0] ?? '', rows: await page.locator('main tbody tr').count(), b }));
  }
}
await browser.close();
