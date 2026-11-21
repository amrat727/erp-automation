// Helper (not a test): READ-ONLY - the "Book hotel" form: options of each dropdown, then Book with QA data; the booking request is BLOCKED and printed.
import { open, SHOTS } from '../lib/probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
await page.goto('/product-search');
await page.getByRole('heading', { name: 'Select an agent to continue' }).waitFor({ timeout: 90000 });
await page.locator('main').getByRole('combobox').first().click();
await page.keyboard.type('Gulf Horiz', { delay: 40 }); await page.waitForTimeout(2000);
await page.getByRole('option', { name: /Gulf Horizons/ }).first().click();
await page.getByRole('button', { name: 'Continue' }).last().click();
await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60000 });
await page.getByPlaceholder('Enter city').click(); await page.keyboard.type('Dubai', { delay: 60 }); await page.waitForTimeout(2500);
await page.getByRole('option').first().click();
await page.getByPlaceholder('Check-in – Check-out').click(); await page.waitForTimeout(800);
for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Next month' }).click(); await page.waitForTimeout(400); }
await page.getByRole('gridcell', { name: '10', exact: true }).first().click();
await page.getByRole('gridcell', { name: '13', exact: true }).first().click();
await page.getByRole('button', { name: 'TBO Holidays', exact: true }).click();
await page.getByRole('button', { name: 'HotelBeds', exact: true }).click();
await page.getByRole('button', { name: 'Search Hotels' }).click();
await page.getByText('Marina Bay Hotel').first().waitFor({ timeout: 60000 });
await page.getByRole('button', { name: /^See \d+ rooms/ }).first().click();
await page.getByRole('button', { name: 'Book', exact: true }).first().click();
const d = page.getByRole('dialog').last();
await d.getByText('Book hotel').waitFor();
await page.waitForTimeout(1500);
console.log('FORM INPUTS', JSON.stringify(await d.locator('input').evaluateAll(es => es.map(e => [e.type, e.name, e.placeholder, e.getAttribute('aria-label'), e.value, e.disabled]))));
console.log('RADIOS/BUTTONS', JSON.stringify((await d.locator('button, [role=radio], label').allInnerTexts()).map(s => s.trim()).filter(Boolean)));
const combos = d.getByRole('combobox');
for (let i = 0; i < await combos.count(); i++) {
  await combos.nth(i).click().catch(() => {}); await page.waitForTimeout(800);
  console.log('COMBO', i, JSON.stringify((await page.getByRole('option').allInnerTexts()).map(s => s.trim()).slice(0, 12)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
await d.getByRole('button', { name: 'Book', exact: true }).click(); await page.waitForTimeout(1500);
console.log('EMPTY BOOK ERRORS', JSON.stringify(await d.locator('.Mui-error, [class*=error]').allInnerTexts()));
await page.screenshot({ path: SHOTS + '/e2e-bookform-empty.png' });
console.log(log.join('\n'));
await browser.close();
