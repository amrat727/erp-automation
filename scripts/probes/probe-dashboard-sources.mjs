// Helper (not a test): READ-ONLY - reads the source lists behind the Dashboard numbers (all pages, Active filter cleared
// where possible) -> reports/dashboard/src-<list>.txt. Every save is BLOCKED.
//   node scripts/probes/probe-dashboard-sources.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

fs.mkdirSync('reports/dashboard', { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
async function readList(name, path) {
  await page.goto(path);
  await page.locator('tbody tr').first().waitFor({ timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // clear the default "Active" filter so inactive / cancelled rows are listed too
  const clear = page.getByRole('button', { name: /^Clear all filters$/i }).first();
  if (await clear.isVisible().catch(() => false)) { await clear.click(); await page.waitForTimeout(3000); }
  // biggest page size
  const size = page.getByRole('combobox', { name: /rows per page/i }).or(page.locator('main [aria-haspopup=listbox]').filter({ hasText: /^\d+$/ })).first();
  if (await size.isVisible().catch(() => false)) { await size.click().catch(() => {}); const opts = page.getByRole('option'); if (await opts.count()) { await opts.last().click(); await page.waitForTimeout(3000); } }
  const head = clean(await page.locator('main thead').first().innerText().catch(() => ''));
  const rows = [];
  for (let p = 0; p < 20; p++) {
    rows.push(...(await page.locator('main tbody tr').allInnerTexts()).map(r => clean(r.replace(/\t/g, ' | '))));
    const next = page.getByRole('button', { name: /next page/i }).first();
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click(); await page.waitForTimeout(2500);
  }
  const foot = clean(await page.locator('main').innerText()).match(/\d+–\d+ of \d+/)?.[0] ?? '';
  fs.writeFileSync(`reports/dashboard/src-${name}.txt`, `${head}\n${rows.join('\n')}`);
  console.log(`== ${name}: ${rows.length} rows (${foot}) | head: ${head}\n${rows.slice(0, 45).join('\n')}`);
}
await readList('reservations', '/reservations');
await readList('quotes', '/quotes');
await readList('agents', '/agents');
await readList('suppliers', '/suppliers');
await readList('contracts', '/contracts');
await readList('enquiries', '/enquiries');
await browser.close();
