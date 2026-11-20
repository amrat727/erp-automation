// Helper (not a test): READ-ONLY - Agent list: reveal each hidden column filter (icon in the header) one by one.
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
await page.goto('/agents');
await page.getByRole('heading', { name: 'Agents' }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const icon = page.getByRole('columnheader', { name: /^Name/ }).first().locator('span[aria-hidden=true]').first();
console.log('name header html', (await page.getByRole('columnheader', { name: /^Name/ }).first().innerHTML()).slice(0, 600));
await icon.click({ force: true }); await page.waitForTimeout(1500);
console.log('after Name icon - inputs in thead', JSON.stringify(await page.locator('main thead input:visible').evaluateAll(es => es.map(e => [e.placeholder, e.closest('th')?.innerText.trim().slice(0, 20)]))));
console.log('textbox in Name header', await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').count());
await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('QA Auto Agent E2E').catch(e => console.log('fill failed'));
await page.waitForTimeout(2500);
console.log('ROWS', JSON.stringify((await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 80))));
await browser.close();
