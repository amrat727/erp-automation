// Helper (not a test): READ-ONLY - new build checks: supplier list On hold filter + paging, Add contract empty-save problems, Add allotment button.
import { open, SHOTS } from './probe-lib.mjs';
import { } from 'fs';
const log = [];
const { browser, page } = await open({ log });
const main = page.locator('main');
// 1. list paging
await page.goto('/suppliers');
await page.getByRole('heading', { name: 'Suppliers' }).first().waitFor({ timeout: 90000 }); await page.waitForTimeout(3000);
const codes = async () => (await main.locator('tbody tr:visible td:nth-child(2)').allInnerTexts()).map(s => s.trim());
const p1 = await codes(); console.log('P1', p1.join(' '), '|', await page.getByText(/^\d+–\d+ of \d+$/).first().innerText());
await page.getByRole('button', { name: /next page/i }).click(); await page.waitForTimeout(3000);
const p2 = await codes(); console.log('P2', p2.join(' '), '|', await page.getByText(/^\d+–\d+ of \d+$/).first().innerText());
console.log('repeated on page 2:', p2.filter(c => p1.includes(c)).join(' '));
// 2. status filter On hold
await page.goto('/suppliers'); await page.waitForTimeout(3500);
const th = page.locator('main thead th').filter({ hasText: /Status/ }).first();
await th.locator('span[aria-hidden=true]').first().click({ force: true }); await page.waitForTimeout(1000);
if (!(await page.getByRole('listbox').isVisible().catch(() => false))) await main.locator('thead').getByRole('combobox').locator('visible=true').first().click();
console.log('OPTIONS', JSON.stringify(await page.getByRole('option').allInnerTexts()));
await page.getByRole('option', { name: 'On hold', exact: true }).click(); await page.waitForTimeout(3000);
console.log('ON HOLD ROWS', (await main.locator('tbody tr:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ')).join(' || ').slice(0, 900));
await page.screenshot({ path: SHOTS + '/onhold-filter.png' });
// 3. Add contract empty save
await page.goto('/suppliers/18/products');
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.getByRole('tab', { name: 'Contract' }).last().click(); await page.waitForTimeout(2500);
await main.getByRole('button', { name: 'Add contract' }).last().click(); await page.waitForTimeout(3000);
await main.getByRole('button', { name: /^Save/ }).last().click(); await page.waitForTimeout(2000);
console.log('PROBLEMS', await page.getByText(/\d+ problems? to fix/).last().innerText().catch(() => '-'));
await page.getByText(/\d+ problems? to fix/).last().click().catch(() => {}); await page.waitForTimeout(1000);
const red = await main.evaluate(m => [...m.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() && /rgb\((19\d|2[0-5]\d), ?([0-9]{1,2}|1[0-2]\d), ?([0-9]{1,2}|1[0-2]\d)\)/.test(getComputedStyle(e).color)).map(e => e.textContent.trim()));
console.log('RED', JSON.stringify([...new Set(red)].slice(0, 20)));
const pop = page.locator('.MuiPopover-paper:visible, .MuiTooltip-popper:visible').last();
console.log('PROBLEM LIST', (await pop.innerText().catch(() => '-')).replace(/\s+/g, ' '));
await page.screenshot({ path: SHOTS + '/contract-empty-save.png', fullPage: true });
// 4. Allotment tab: Add allotment disabled?
await page.goto('/suppliers/18/products');
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.getByRole('tab', { name: 'Allotment' }).last().click(); await page.waitForTimeout(3000);
const add = main.getByRole('button', { name: 'Add allotment' }).last();
console.log('ADD ALLOTMENT enabled:', await add.isEnabled(), '| title:', await add.getAttribute('title'), '| near:', (await main.innerText()).replace(/\s+/g, ' ').match(/.{0,200}Add allotment.{0,200}/)?.[0]);
console.log(log.join('\n'));
await browser.close();
