// Helper (not a test): READ-ONLY - one agent's status, access counters and financials.
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
const id = process.argv[2];
for (const tab of ['overview', 'access', 'financials']) {
  await page.goto(`/agents/${id}/${tab}`);
  await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(4000);
  const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  const i = t.lastIndexOf('AG-000');
  console.log(`== ${tab}: ` + t.slice(i, i + 700));
}
await browser.close();
