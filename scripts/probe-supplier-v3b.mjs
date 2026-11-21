// Helper (not a test): READ-ONLY - new build: Add supplier status buttons (which is selected), Name sort control, contract default dates vs time zones.
import { open, SHOTS } from './probe-lib.mjs';
const { browser, page } = await open();
const main = page.locator('main');
await page.goto('/suppliers');
await page.getByRole('heading', { name: 'Suppliers' }).first().waitFor({ timeout: 90000 }); await page.waitForTimeout(3000);
console.log('NAME TH', (await main.locator('thead th').first().innerHTML()).replace(/<svg.*?<\/svg>/g, '').replace(/ class="[^"]*"/g, '').slice(0, 700));
await main.getByRole('button', { name: 'Add supplier' }).click(); await page.waitForTimeout(3000);
for (const b of ['Approved', 'On hold', 'Blocked']) {
  const el = page.getByRole('button', { name: b, exact: true });
  console.log('STATUS', b, JSON.stringify(await el.evaluate(e => ({ cls: e.className, pressed: e.getAttribute('aria-pressed'), sel: e.getAttribute('aria-selected'), cur: e.getAttribute('aria-current'), data: Object.fromEntries([...e.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value])), color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }))));
}
await page.goto('/suppliers/18/products');
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.getByRole('tab', { name: 'Contract' }).last().click(); await page.waitForTimeout(2500);
await main.getByRole('button', { name: 'Add contract' }).last().click(); await page.waitForTimeout(3000);
const dates = await page.locator('main input[placeholder="Choose a date"]:visible').evaluateAll(es => es.map(e => e.value));
const now = new Date();
console.log('DEFAULT DATES', JSON.stringify(dates), '| now UTC', now.toISOString(), '| Dubai', now.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }), '| browser', now.toString());
await page.locator('main input[placeholder="Choose a date"]:visible').first().evaluate(e => { e.style.outline = '3px solid red'; });
await page.screenshot({ path: SHOTS + '/contract-default-dates.png' });
await browser.close();
