// Helper (not a test): READ-ONLY - contract rows of a supplier's hotel matching a text: node scripts/probe-contract-rows.mjs 18 VMPNTK
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
const [id, want] = process.argv.slice(2);
await page.goto(`/suppliers/${id}/products`);
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.getByRole('tab', { name: 'Contract' }).last().click();
await page.waitForTimeout(4000);
const table = page.locator('main table').filter({ has: page.getByRole('columnheader', { name: /^Validity/ }) });
for (const r of await table.locator('tbody tr').all()) {
  const t = (await r.innerText()).replace(/\s+/g, ' ');
  if (!want || t.includes(want)) console.log(t, '| active switch:', await r.getByRole('switch').isChecked().catch(() => 'n/a'));
}
await browser.close();
