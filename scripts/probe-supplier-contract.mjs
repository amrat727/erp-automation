// Helper (not a test): READ-ONLY - a supplier's hotel: Overview (status, city), Contract list + first contract detail, Allotment, Promotions.
//   node scripts/probe-supplier-contract.mjs <supplierId> [contract name part]
import { open, SHOTS } from './probe-lib.mjs';
const { browser, page } = await open();
const id = process.argv[2] || '10';
const want = process.argv[3] || '';
const main = page.locator('main');
const txt = async () => (await main.innerText()).replace(/\s+/g, ' ');
await page.goto(`/suppliers/${id}/overview`);
await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
let t = await txt(); console.log('== OVERVIEW ' + t.slice(t.lastIndexOf('Overview') - 200, t.lastIndexOf('Overview') + 500));
const sub = async (name) => {
  await page.goto(`/suppliers/${id}/products`);
  await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Contract' }).last().waitFor({ timeout: 60000 });
  if (name !== 'Products') await page.getByRole('tab', { name }).last().click();
  await page.waitForTimeout(3500);
  const s = await txt(); return s.slice(s.indexOf('Rate check') + 10);
};
console.log('\n== PRODUCTS ' + (await sub('Products')).slice(0, 1200));
console.log('\n== CONTRACTS ' + (await sub('Contract')).slice(0, 1500));
const row = main.locator('tbody tr', { hasText: want }).first();
if (await row.count()) {
  await row.locator('td').first().click(); await page.waitForTimeout(4000);
  const d = page.locator('.MuiDialog-paper:visible').last();
  const s = (await d.count()) ? (await d.innerText()).replace(/\s+/g, ' ') : await txt();
  console.log('\n== CONTRACT DETAIL ' + page.url() + '\n' + s.slice(0, 6000));
  await page.screenshot({ path: `${SHOTS}/contract-${id}.png`, fullPage: true });
}
console.log('\n== ALLOTMENT ' + (await sub('Allotment')).slice(0, 1500));
console.log('\n== PROMOTIONS ' + (await sub('Promotions')).slice(0, 1500));
await browser.close();
