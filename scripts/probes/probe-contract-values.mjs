// Helper (not a test): READ-ONLY - values inside a supplier's first hotel contract form and its first promotion form.
//   node scripts/probes/probe-contract-values.mjs <supplierId>
import { open } from '../lib/probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '10';
const main = page.locator('main');
const go = async (sub, header) => {
  await page.goto(`/suppliers/${id}/products`);
  await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Contract' }).last().waitFor({ timeout: 60000 });
  await page.getByRole('tab', { name: sub }).last().click();
  await page.waitForTimeout(3000);
  await main.locator('table').filter({ has: page.getByRole('columnheader', { name: header }) }).locator('tbody tr').first().locator('td').first().click();
  await page.waitForTimeout(4500);
};
// every field: section heading + label + value, in screen order
const dump = async () => main.evaluate(root => {
  const out = []; let section = '';
  for (const el of root.querySelectorAll('h1,h2,h3,h4,h5,h6,input,textarea,[role=combobox],th')) {
    if (/^H\d$/.test(el.tagName)) { section = el.textContent.trim(); continue; }
    if (el.tagName === 'TH') continue;
    const v = el.value ?? el.textContent;
    if (!v || el.type === 'hidden') continue;
    const lab = el.getAttribute('aria-label') || el.placeholder || el.closest('.MuiFormControl-root')?.querySelector('label')?.textContent || el.closest('td')?.cellIndex;
    const checked = el.type === 'checkbox' ? (el.checked ? 'ON' : 'off') : '';
    out.push(`[${section}] ${lab}: ${checked || v}`);
  }
  return out;
});
await go('Contract', /^Validity/);
console.log('CONTRACT\n' + (await dump()).join('\n'));
await go('Promotions', /^Benefits/);
console.log('\nPROMOTION\n' + (await dump()).join('\n'));
await browser.close();
