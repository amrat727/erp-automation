// Helper (not a test): READ-ONLY - status of agents by id: node scripts/probe-agent-ids.mjs 30 31 32 33 34
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
for (const id of process.argv.slice(2)) {
  await page.goto(`/agents/${id}/overview`);
  const ok = await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 60000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(2500);
  const t = ok ? (await page.locator('main').innerText()).replace(/\s+/g, ' ') : '';
  const m = [...t.matchAll(/(AG-\d+) · (\S+) \S+ (Approved|On Hold|Blocked)/g)].pop();
  console.log(id, m ? m[1] + ' ' + m[2] + ' -> ' + m[3] : 'not found');
}
await browser.close();
