// Helper (not a test): READ-ONLY - records the JSON the server sends to the list pages and the Dashboard
// (GET responses only; every save is BLOCKED) -> reports/dashboard/api-<page>.json, and prints the field names,
// so creation dates and statuses can be counted exactly.
//   node scripts/probes/probe-api-data.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

fs.mkdirSync('reports/dashboard', { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(30000);
let bag = [];
page.on('response', async r => {
  if (r.request().method() !== 'GET' || !/pilottest/.test(r.url())) return;
  const ct = r.headers()['content-type'] || '';
  if (!ct.includes('json')) return;
  try { bag.push({ url: r.url().replace(/^https:\/\/[^/]+/, ''), body: await r.json() }); } catch {}
});
const keysOf = b => { const arr = Array.isArray(b) ? b : (b?.items || b?.data || b?.results || b?.records || null); const one = Array.isArray(arr) ? arr[0] : b; return one && typeof one === 'object' ? Object.keys(one).slice(0, 40) : []; };
for (const [name, path] of [['agents', '/agents'], ['suppliers', '/suppliers'], ['reservations', '/reservations'], ['quotes', '/quotes'], ['dashboard', '/dashboard']]) {
  bag = [];
  await page.goto(path); await page.waitForTimeout(9000);
  if (name === 'dashboard') for (const t of ['Sales', 'Partners', 'Contracts', 'Allotments', 'Quotations', 'Feedback']) { await page.getByRole('tab', { name: t, exact: true }).first().click().catch(() => {}); await page.waitForTimeout(5000); }
  fs.writeFileSync(`reports/dashboard/api-${name}.json`, JSON.stringify(bag, null, 1));
  console.log(`== ${name}: ${bag.length} JSON responses`);
  for (const b of bag) console.log(`   ${b.url.slice(0, 110)} | keys: ${keysOf(b.body).join(',').slice(0, 300)}`);
}
await browser.close();
