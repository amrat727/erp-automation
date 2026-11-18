// Helper (not a test): walks a top-level menu module (e.g. "Supplier") through every nested group
// and prints URL / heading / buttons / table headers for each screen. ALL writes are blocked.
// Run:  node scripts/discover-module.mjs Supplier out.json
import { chromium } from '@playwright/test';
import fs from 'fs';

const MODULE = process.argv[2] ?? 'Supplier';
const OUT = process.argv[3] ?? `discover-${MODULE}.json`;
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !r.request().url().includes('negotiate') ? r.abort() : r.continue());
const page = await ctx.newPage();
const nav = page.locator('nav, aside').first();
const btns = async () => (await nav.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean);
const out = { module: MODULE, topLevel: [], screens: [] };

const openChain = async chain => {
  await page.goto('/dashboard');
  await nav.getByRole('button', { name: MODULE, exact: true }).first().click({ timeout: 90_000 });
  await page.waitForTimeout(800);
  for (const c of chain) { await nav.getByRole('button', { name: c, exact: true }).first().click(); await page.waitForTimeout(800); }
};

// what appears after expanding the module, then recursively after expanding each item
const walk = async (chain, depth) => {
  await openChain(chain.slice(0, -1));
  const before = await btns();
  if (chain.length) { await nav.getByRole('button', { name: chain.at(-1), exact: true }).first().click(); await page.waitForTimeout(1000); }
  const urlBefore = page.url();
  const items = (await btns()).filter(t => !before.includes(t));
  if (chain.length && items.length === 0) return false;          // a leaf (it navigated or opened nothing)
  if (!chain.length) out.topLevel = items;
  for (const item of items) {
    const isGroup = depth < 3 && await walk([...chain, item], depth + 1);
    if (isGroup) continue;
    try {
      await openChain([...chain, item]);
      await page.waitForTimeout(6000);
      const main = page.locator('main');
      out.screens.push({
        path: [...chain, item].join(' > '),
        url: new URL(page.url()).pathname,
        headings: (await page.getByRole('heading').allInnerTexts()).map(s => s.trim()).filter(s => s && !/^Good /.test(s)).slice(0, 4),
        buttons: (await main.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 15),
        columns: (await main.getByRole('columnheader').allInnerTexts()).map(s => s.replace(/[​\s]+/g, ' ').trim()).filter(Boolean),
        rows: await main.locator('tbody tr').count(),
        text: (await main.innerText()).replace(/[​]/g, '').replace(/\n{2,}/g, '\n').slice(0, 1500),
      });
      console.log('screen', [...chain, item].join(' > '), new URL(page.url()).pathname);
      await page.screenshot({ path: `${OUT}.${[...chain, item].join('_').replace(/[^\w]+/g, '-')}.png` });
    } catch (e) { out.screens.push({ path: [...chain, item].join(' > '), error: String(e).slice(0, 300) }); }
  }
  return true;
};

await walk([], 0);
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('top level:', out.topLevel, '| screens:', out.screens.length);
await browser.close();
