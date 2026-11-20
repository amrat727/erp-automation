// Helper (not a test): READ-ONLY - v1.0.2 Agent list: where did the Name / Email search boxes go?
import { open, buttons, SHOTS } from './probe-lib.mjs';
const { browser, page } = await open();
await page.goto('/agents');
await page.getByRole('heading', { name: 'Agents' }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log('BUTTONS', JSON.stringify(await page.locator('main button:visible').evaluateAll(bs => bs.map(b => b.innerText.trim() || b.getAttribute('aria-label') || b.title))));
console.log('INPUTS', JSON.stringify(await page.locator('main input:visible').evaluateAll(es => es.map(e => [e.placeholder, e.getAttribute('aria-label')]))));
const t = page.locator('main button:visible').first();
console.log('first button', await t.getAttribute('aria-label'));
await t.click(); await page.waitForTimeout(1500);
console.log('INPUTS after', JSON.stringify(await page.locator('main input:visible').evaluateAll(es => es.map(e => [e.placeholder, e.getAttribute('aria-label')]))));
await page.screenshot({ path: SHOTS + '/agents-v102.png' });
await browser.close();
