// Helper (not a test): READ-ONLY - Product Search > Hotel: the date picker, then a search on own contracts only.
import { open, text, buttons, SHOTS } from '../lib/probe-lib.mjs';
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
await page.getByPlaceholder('Check-in – Check-out').click(); await page.waitForTimeout(1500);
const pop = page.locator('.MuiPopover-paper:visible, .MuiPickersPopper-root:visible, [role=dialog]:visible').last();
console.log('PICKER', (await pop.innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 700));
console.log('PICKER BUTTONS', JSON.stringify((await pop.locator('button').evaluateAll(b => b.map(x => x.getAttribute('aria-label') || x.innerText))).slice(0, 25)));
await page.screenshot({ path: SHOTS + '/e2e-hotel-picker.png' });
await browser.close();
