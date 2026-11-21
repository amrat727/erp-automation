// Helper (not a test): READ-ONLY - how to type a price into the contract price sheet on the new build (saves BLOCKED).
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
const main = page.locator('main');
await page.goto('/suppliers/18/products');
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.getByRole('tab', { name: 'Contract' }).last().click(); await page.waitForTimeout(2500);
await main.getByRole('button', { name: 'Add contract' }).last().click(); await page.waitForTimeout(3000);
await page.locator('main input[placeholder="Choose a base plan"]:visible').click();
await page.getByRole('option', { name: 'Bed and breakfast' }).click(); await page.waitForTimeout(1000);
// add a season the way ContractPage.addSeason does: look for the season inputs
await main.getByRole('button', { name: 'Add season' }).last().click(); await page.waitForTimeout(1000);
const dl = page.getByRole('dialog').last();
await dl.getByPlaceholder('Enter a season name').fill('QA Season');
await dl.getByRole('button', { name: 'Add season' }).click(); await page.waitForTimeout(2000);
const cells = main.locator('input[data-rate-cell]:visible');
console.log('cells', await cells.count(), JSON.stringify(await cells.evaluateAll(es => es.slice(0, 6).map(e => [e.getAttribute('aria-label'), e.value]))));
const c0 = cells.nth(0), c1 = cells.nth(1), c2 = cells.nth(2), c3 = cells.nth(3);
await c0.click(); await c0.press('Control+A'); await c0.pressSequentially('450', { delay: 30 }); await c0.press('Tab');
await c1.fill('450'); await c1.press('Tab');
await c2.click(); await page.waitForTimeout(300); await c2.press('Control+A'); await page.waitForTimeout(200); await c2.pressSequentially('450', { delay: 60 }); await c2.press('Tab');
await c3.focus(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.keyboard.type('450', { delay: 40 }); await page.keyboard.press('Tab');
await page.waitForTimeout(800);
console.log('after', JSON.stringify(await cells.evaluateAll(es => es.slice(0, 4).map(e => e.value))));
await browser.close();
