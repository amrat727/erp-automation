// Helper (not a test): READ-ONLY evidence for BUG-132 - 1 adult, Marina Bay Hotel, 19-22 Jan 2027: single-room early bird 350.98 instead of 351.00.
import { open } from '../lib/probe-lib.mjs';
const { browser, page } = await open();
await page.goto('/product-search');
await page.getByRole('heading', { name: 'Select an agent to continue' }).waitFor({ timeout: 90000 });
await page.locator('main').getByRole('combobox').first().click();
await page.keyboard.type('QA Auto B2B', { delay: 30 }); await page.waitForTimeout(2000);
await page.getByRole('option', { name: /QA Auto B2B Agent/ }).first().click();
await page.getByRole('button', { name: 'Continue' }).last().click();
await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60000 });
await page.getByPlaceholder('Enter city').click(); await page.keyboard.type('Dubai', { delay: 60 }); await page.waitForTimeout(2500);
await page.getByRole('option').first().click();
await page.getByPlaceholder('Check-in – Check-out').click(); await page.waitForTimeout(800);
for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Next month' }).click(); await page.waitForTimeout(300); }
await page.getByRole('gridcell', { name: '19', exact: true }).first().click();
await page.getByRole('gridcell', { name: '22', exact: true }).first().click();
await page.getByRole('button', { name: /room · \d+ guests?/ }).last().click();
await page.locator('.MuiPopover-paper:visible input[aria-label="Adults"]').fill('1');
await page.getByRole('button', { name: 'Done' }).click();
for (const s of ['TBO Holidays', 'HotelBeds']) await page.getByRole('button', { name: s, exact: true }).click();
await page.getByRole('button', { name: 'Search Hotels' }).click();
await page.getByRole('button', { name: 'Marina Bay Hotel', exact: true }).waitFor({ timeout: 90000 });
await page.getByRole('button', { name: /^See \d+ rooms/ }).first().click(); await page.waitForTimeout(1500);
const line = page.locator('main').getByRole('button', { name: 'Book', exact: true }).first().locator('xpath=ancestor::*[.//button[normalize-space(.)="Policy"]][1]');
console.log((await line.innerText()).replace(/\s+/g, ' '));
await line.scrollIntoViewIfNeeded();
await line.evaluate(e => { e.style.outline = '3px solid red'; });
await page.screenshot({ path: 'screenshots/bugs/BUG-132-single-early-bird-rounding.png' });
await browser.close();
