// Helper (not a test): READ-ONLY - Product Search > Hotel tab: form fields, a Dubai search, the results and a result's buttons.
import { open, text, buttons, SHOTS } from '../lib/probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const AGENT = process.argv[2] || 'Gulf Horizons Travel LLC';
const DEST = process.argv[3] || 'Dubai';
await page.goto('/product-search');
await page.getByRole('heading', { name: 'Select an agent to continue' }).waitFor({ timeout: 90000 });
await page.locator('main').getByRole('combobox').first().click();
await page.keyboard.type(AGENT.slice(0, 10), { delay: 40 }); await page.waitForTimeout(2000);
await page.getByRole('option', { name: new RegExp(AGENT) }).first().click();
await page.getByRole('button', { name: 'Continue' }).last().click();
await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60000 });
await page.waitForTimeout(2000);
console.log('HOTEL FORM', (await text(page)).slice(0, 800));
console.log('INPUTS', JSON.stringify(await page.locator('main input:visible').evaluateAll(es => es.map(e => [e.type, e.placeholder, e.getAttribute('aria-label'), e.value]))));
const dest = page.locator('main input:visible').filter({ hasNot: page.locator('[disabled]') }).nth(1);
const destIn = page.getByPlaceholder(/destination|city|where/i).first();
await destIn.click(); await page.keyboard.type(DEST, { delay: 60 }); await page.waitForTimeout(3000);
console.log('DEST OPTIONS', JSON.stringify((await page.getByRole('option').allInnerTexts()).map(s => s.replace(/\s+/g, ' ')).slice(0, 10)));
await page.getByRole('option').first().click().catch(e => console.log('no option', e.message.slice(0, 80)));
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOTS + '/e2e-hotel-form.png' });
const search = page.getByRole('button', { name: /^Search/ }).last();
console.log('search button:', await search.innerText(), 'enabled', await search.isEnabled());
if (await search.isEnabled()) {
  await search.click();
  await page.waitForTimeout(12000);
  console.log('RESULTS', (await text(page)).slice(0, 2500));
  console.log('BUTTONS', JSON.stringify((await buttons(page)).slice(0, 60)));
  await page.screenshot({ path: SHOTS + '/e2e-hotel-results.png', fullPage: true });
}
console.log(log.join('\n'));
await browser.close();
