// Helper (not a test): opens the ERP with the saved login and prints every screen under "Core"
// with its URL and page heading.   Run:  node scripts/discover-core.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';

const GROUPS = ['Application', 'Region', 'Product', 'Resource', 'Organization', 'Accounts', 'System'];
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com' });
await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const nav = page.locator('nav, aside').first();
const menuButtons = async () => (await nav.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean);

const result = [];
for (const g of GROUPS) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Core', exact: true }).click({ timeout: 60_000 });
  const before = await menuButtons();
  await nav.getByRole('button', { name: g, exact: true }).click();
  await page.waitForTimeout(800);
  const items = (await menuButtons()).filter(t => !before.includes(t));
  for (const item of items) {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Core', exact: true }).click({ timeout: 60_000 });
    await nav.getByRole('button', { name: g, exact: true }).click();
    await nav.getByRole('button', { name: item, exact: true }).click();
    await page.waitForTimeout(4000);
    const h = (await page.getByRole('heading').allInnerTexts()).map(s => s.trim()).filter(s => s && !/^Good /.test(s));
    const buttons = (await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 12);
    const rows = await page.locator('main tbody tr').count();
    result.push({ group: g, item, url: new URL(page.url()).pathname, heading: h[0] ?? '', rows, buttons });
    console.log(JSON.stringify(result.at(-1)));
  }
}
fs.writeFileSync(process.argv[2] || 'core-screens.json', JSON.stringify(result, null, 2));
await browser.close();
