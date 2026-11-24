// Helper (not a test): READ-ONLY - walks the ERP side menu (every group and sub-group) and lists every screen it opens
// -> reports/ui-consistency/menu.json. Every save is BLOCKED.
//   node scripts/probes/ui-menu-inventory.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

fs.mkdirSync('reports/ui-consistency', { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(20000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
await page.goto('/dashboard');
const nav = page.locator('nav').first();
await nav.waitFor({ timeout: 90000 });
await page.waitForTimeout(4000);
const navTexts = async () => (await nav.locator('[role=button], a, button').allInnerTexts()).map(clean).filter(t => t && t.length < 40);
const screens = new Map();
const visited = new Set();
// breadth-first: click every menu entry; if the address changes it is a screen, otherwise it is a group that opened
async function walk(trail) {
  for (const t of await navTexts()) {
    const key = [...trail, t].join(' > ');
    if (visited.has(key) || trail.includes(t)) continue;
    visited.add(key);
    const before = page.url(), itemsBefore = (await navTexts()).length;
    await nav.getByText(t, { exact: true }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const after = page.url();
    if (after !== before && !screens.has(new URL(after).pathname)) {
      screens.set(new URL(after).pathname, { menu: [...trail, t].join(' > '), path: new URL(after).pathname });
    } else if ((await navTexts()).length > itemsBefore && trail.length < 3) {
      await walk([...trail, t]);   // a group opened: walk its children
    }
  }
}
await walk([]);
const list = [...screens.values()].filter(s => s.path !== '/');
fs.writeFileSync('reports/ui-consistency/menu.json', JSON.stringify(list, null, 1));
console.log(`${list.length} screens:`);
console.log(list.map(i => `${i.menu} -> ${i.path}`).join('\n'));
await browser.close();
