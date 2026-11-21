// Helper (not a test): READ-ONLY - Product Search > Hotel "Rooms & Guests" picker (adults / children / ages).
import { open, SHOTS } from './probe-lib.mjs';
const { browser, page } = await open();
await page.goto('/product-search');
await page.getByRole('heading', { name: 'Select an agent to continue' }).waitFor({ timeout: 90000 });
await page.locator('main').getByRole('combobox').first().click();
await page.keyboard.type('QA Auto B2B', { delay: 30 }); await page.waitForTimeout(2000);
await page.getByRole('option', { name: /QA Auto B2B Agent/ }).first().click();
await page.getByRole('button', { name: 'Continue' }).last().click();
await page.getByRole('button', { name: 'Hotel', exact: true }).click({ timeout: 60000 });
await page.getByRole('button', { name: /room · \d+ guests?/ }).last().click();
await page.waitForTimeout(1500);
const pop = page.locator('.MuiPopover-paper:visible, .MuiDialog-paper:visible, .MuiMenu-paper:visible').last();
console.log('PICKER', (await pop.innerText()).replace(/\s+/g, ' '));
console.log('BUTTONS', JSON.stringify(await pop.locator('button').evaluateAll(b => b.map(x => x.getAttribute('aria-label') || x.innerText.trim()))));
console.log('HTML', (await pop.innerHTML()).replace(/<svg.*?<\/svg>/g, '').replace(/ class="[^"]*"/g, '').slice(0, 2500));
// the 4 unnamed buttons are adults -/+ and children -/+ : press children "+" (4th) once
await pop.locator('button').nth(4).click(); await page.waitForTimeout(800);
console.log('AFTER 4th', (await pop.innerText()).replace(/\s+/g, ' '));
console.log('INPUTS', JSON.stringify(await pop.locator('input,[role=combobox]').evaluateAll(es => es.map(e => [e.getAttribute('aria-label') || e.placeholder, e.value ?? e.textContent]))));
const inc = pop.locator('button[aria-label*="child" i]').filter({ hasText: '' });
console.log('child buttons', JSON.stringify(await pop.locator('button[aria-label]').evaluateAll(b => b.map(x => x.getAttribute('aria-label')))));
const add = pop.locator('button[aria-label^="Increase children" i], button[aria-label*="add child" i]').first();
if (await add.count()) { await add.click(); await page.waitForTimeout(800); console.log('AFTER +CHILD', (await pop.innerText()).replace(/\s+/g, ' ')); console.log('INPUTS', JSON.stringify(await pop.locator('input,[role=combobox]').evaluateAll(es => es.map(e => [e.getAttribute('aria-label'), e.value ?? e.textContent])))); }
await page.screenshot({ path: SHOTS + '/guests-picker.png' });
await browser.close();
