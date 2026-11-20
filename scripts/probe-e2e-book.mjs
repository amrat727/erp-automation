// Helper (not a test): READ-ONLY - from hotel results: See rooms -> pick the first room -> follow the booking screens; every save is BLOCKED and logged.
import { open, text, buttons, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const step = async (name) => {
  await page.waitForTimeout(3500);
  console.log(`\n=== ${name} | ${page.url()}`);
  const dlg = page.locator('.MuiDialog-paper:visible, .MuiDrawer-paper:visible').last();
  if (await dlg.count()) console.log('DIALOG', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 1500));
  console.log('TEXT', (await text(page)).slice(0, 1800));
  console.log('BUTTONS', JSON.stringify((await buttons(page, 'body')).filter(b => b.length < 40).slice(-40)));
  await page.screenshot({ path: `${SHOTS}/e2e-book-${name}.png`, fullPage: true });
};
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
const card = page.locator('main').getByText('Marina Bay Hotel').first().locator('xpath=ancestor::*[.//button[contains(.,"See")]][1]');
await card.getByRole('button', { name: /^See \d+ rooms/ }).click();
await step('1-rooms');
const choose = page.getByRole('button', { name: /^(Select|Book|Choose|Add|Reserve)/ }).filter({ visible: true });
console.log('choose-like buttons:', JSON.stringify(await choose.allInnerTexts()));
if (await choose.count()) { await choose.first().click(); await step('2-after-select'); }
const next = page.getByRole('button', { name: /^(Continue|Book|Checkout|Proceed|Next|Book now|Go to cart)/ }).filter({ visible: true });
console.log('next-like buttons:', JSON.stringify(await next.allInnerTexts()));
if (await next.count()) { await next.first().click(); await step('3-next'); }
console.log('\nREQUESTS\n' + log.join('\n'));
await browser.close();
