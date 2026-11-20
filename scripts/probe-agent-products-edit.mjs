// Helper (not a test): READ-ONLY - Agent > Access > Products > Edit: what can be chosen; Save is BLOCKED and printed.
import { open, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '24';
await page.goto(`/agents/${id}/access`);
await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const card = page.locator('main').getByText('Products', { exact: true }).first().locator('xpath=ancestor::*[.//button[normalize-space(.)="Edit"]][1]');
console.log('CARD', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 300));
console.log('card buttons', JSON.stringify(await card.locator('button').evaluateAll(b => b.map(x => [x.innerText.trim(), x.getAttribute('aria-label')])))); await card.locator('button', { hasText: 'Edit' }).first().click();
await page.waitForTimeout(2000);
const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-paper:visible').last();
const scope = (await d.count()) ? d : card;
console.log('EDITOR', (await scope.innerText()).replace(/\s+/g, ' ').slice(0, 1500));
console.log('BUTTONS', JSON.stringify((await scope.locator('button:visible').allInnerTexts()).map(s => s.trim()).filter(Boolean)));
console.log('SWITCHES', JSON.stringify(await scope.locator('input[type=checkbox]').evaluateAll(es => es.map(e => [e.getAttribute('aria-label'), e.checked]))));
await page.screenshot({ path: SHOTS + '/agent-products-edit.png', fullPage: true });
const all = scope.getByRole('button', { name: 'All', exact: true });
if (await all.count()) { await all.first().click(); await page.waitForTimeout(800); }
const save = scope.getByRole('button', { name: /^Save/ });
if (await save.count()) { await save.first().click(); await page.waitForTimeout(2000); }
console.log(log.join('\n'));
await browser.close();
