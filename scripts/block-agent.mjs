// Helper (not a test): sets QA agents to Blocked by id (REAL save) - only for "QA Auto ..." agents.
//   node scripts/block-agent.mjs 33 [34 ...]
import { open } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ allowWrites: true, log });
for (const id of process.argv.slice(2)) {
  await page.goto(`/agents/${id}/overview`);
  await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  const name = await page.locator('main input[placeholder="Agent name"]').first().inputValue().catch(() => '');
  const head = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  if (!/QA Auto/.test(head.slice(head.lastIndexOf('AG-000') - 80))) { console.log(id, 'is not a QA Auto agent - skipped'); continue; }
  const btn = (n) => page.locator('main button:visible', { hasText: new RegExp(`^${n}$`) }).last();
  await btn('Edit').click();
  await page.locator('main input[value="Approved"], main input[value="On Hold"], main input[value="Blocked"]').first().click();
  await page.getByRole('option', { name: 'Blocked', exact: true }).click();
  const done = page.waitForResponse(r => /\/agent/i.test(r.url()) && ['PUT', 'POST', 'PATCH'].includes(r.request().method()), { timeout: 60000 });
  await btn('Save').click();
  console.log(id, name, '-> Blocked', (await done).status());
}
await browser.close();
