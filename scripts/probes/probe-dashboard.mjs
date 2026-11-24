// Helper (not a test): READ-ONLY - reads the text of every Dashboard tab (Insights > Dashboard) and saves a full-page
// screenshot per tab, so each number can be compared with the source screens. Every save is BLOCKED.
//   node scripts/probes/probe-dashboard.mjs   -> reports/dashboard/<tab>.txt + screenshots/dashboard/<tab>.png
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

fs.mkdirSync('reports/dashboard', { recursive: true }); fs.mkdirSync('screenshots/dashboard', { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
await page.goto('/dashboard');
await page.getByRole('tab', { name: 'Overview' }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(6000);
const tabs = (await page.getByRole('tab').allInnerTexts()).map(clean).filter(Boolean);
console.log('tabs:', JSON.stringify(tabs));
for (const t of tabs) {
  await page.getByRole('tab', { name: t, exact: true }).first().click();
  await page.waitForTimeout(6000);
  const txt = clean(await page.locator('main').innerText());
  const slug = t.replace(/[^\w]+/g, '-');
  fs.writeFileSync(`reports/dashboard/${slug}.txt`, txt);
  await page.screenshot({ path: `screenshots/dashboard/${slug}.png`, fullPage: true });
  console.log(`== ${t}: ${txt.slice(0, 1500)}`);
}
await browser.close();
