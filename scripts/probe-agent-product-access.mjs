// Helper (not a test): READ-ONLY - where does an agent get "product access"? Lists the agent tabs and the Access tab sections.
import { open, text, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '24';
await page.goto(`/agents/${id}/overview`);
await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(2500);
console.log('TABS', JSON.stringify(await page.getByRole('tab').allInnerTexts()));
for (const t of ['access', 'products', 'product-access', 'markups']) {
  await page.goto(`/agents/${id}/${t}`); await page.waitForTimeout(3500);
  const s = await text(page);
  console.log(`\n== ${t}: ${page.url()}\n` + s.slice(0, 1600));
  if (/product/i.test(s)) await page.screenshot({ path: `${SHOTS}/agent-${t}.png`, fullPage: true });
}
await browser.close();
