// Helper (not a test): READ-ONLY - Product Search > Hotel: Dubai, 10-13 Jan 2027, own contracts only; results and a hotel's rooms.
import { open, text, buttons, SHOTS } from './probe-lib.mjs';
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
await page.getByPlaceholder('Check-in – Check-out').click(); await page.waitForTimeout(1000);
const cal = page.getByText('Select check-in').locator('xpath=ancestor::*[.//button][1]');
const html = await cal.evaluate(e => [...e.querySelectorAll('button')].slice(0, 6).map(b => b.outerHTML.slice(0, 200)));
console.log('CAL BUTTONS', html.join('\n'));
for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: /next month/i }).click().catch(async () => { await cal.locator('button').nth(1).click(); }); await page.waitForTimeout(500); }
console.log('MONTH', (await cal.innerText()).replace(/\s+/g, ' ').slice(0, 60));
await page.getByRole('gridcell', { name: '10', exact: true }).or(page.getByRole('button', { name: '10', exact: true })).first().click();
await page.waitForTimeout(700);
console.log('AFTER 1st', (await page.locator('body').innerText()).match(/Select check-?\w+/g));
await page.getByRole('gridcell', { name: '13', exact: true }).or(page.getByRole('button', { name: '13', exact: true })).first().click();
await page.waitForTimeout(700);
console.log('DATES', await page.getByPlaceholder('Check-in – Check-out').inputValue());
for (const s of ['TBO Holidays', 'HotelBeds', 'Own contracts']) {
  const chip = page.getByRole('button', { name: s, exact: true });
  console.log('chip', s, await chip.evaluate(e => e.className.slice(0, 120) + ' pressed=' + e.getAttribute('aria-pressed')));
}
await page.getByRole('button', { name: 'TBO Holidays', exact: true }).click();
await page.getByRole('button', { name: 'HotelBeds', exact: true }).click();
for (const s of ['TBO Holidays', 'HotelBeds', 'Own contracts']) console.log('chip after', s, await page.getByRole('button', { name: s, exact: true }).evaluate(e => e.className.slice(0, 120) + ' pressed=' + e.getAttribute('aria-pressed')));
await page.screenshot({ path: SHOTS + '/e2e-hotel-ready.png' });
await page.getByRole('button', { name: 'Search Hotels' }).click();
await page.waitForTimeout(15000);
console.log('RESULTS', (await text(page)).slice(0, 2500));
await page.screenshot({ path: SHOTS + '/e2e-hotel-results.png', fullPage: true });
console.log(log.join('\n'));
await browser.close();
