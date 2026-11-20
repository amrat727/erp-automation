// Helper (not a test): READ-ONLY - Agent > Access > Portal login > Edit: what it asks for (saves BLOCKED, nothing typed).
import { open, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '33';
await page.goto(`/agents/${id}/access`);
await page.getByRole('tab', { name: 'Access', exact: true }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const edits = page.locator('main button[aria-label^="Edit"]');
console.log('EDIT BUTTONS', JSON.stringify(await edits.evaluateAll(b => b.map(x => x.getAttribute('aria-label')))));
const pl = page.locator('main button[aria-label="Edit Portal login"]').or(page.locator('main').getByText('Portal login', { exact: true }).locator('xpath=ancestor::*[.//button][1]').locator('button', { hasText: 'Edit' })).first();
await pl.click(); await page.waitForTimeout(2000);
const d = page.locator('.MuiDialog-paper:visible').last();
console.log('DIALOG', (await d.innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 1200));
console.log('INPUTS', JSON.stringify(await d.locator('input, textarea').evaluateAll(es => es.map(e => [e.type, e.getAttribute('aria-label') || e.placeholder || e.name]))));
await page.screenshot({ path: `${SHOTS}/portal-login-edit.png` });
await browser.close();
