// Helper (not a test): READ-ONLY evidence of 3 supplier fixes on the 21 Nov 2026 stage build (every save BLOCKED):
//   BUG-57 supplier City locked in Edit, BUG-66 Add allotment disabled without an active contract, BUG-78 6 MB document refused.
// Screenshots -> screenshots/fixed/
import { open } from './probe-lib.mjs';
import fs from 'fs';
const log = [];
const { browser, page } = await open({ log });
const main = page.locator('main');
fs.mkdirSync('screenshots/fixed', { recursive: true });
const mark = async (l) => { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.evaluate(e => { e.style.outline = '3px solid #16a34a'; e.style.outlineOffset = '2px'; }).catch(() => {}); };

// BUG-57: Edit "Testing season 3" (id 18), open Location, City is disabled
await page.goto('/suppliers/18/overview');
await page.getByRole('button', { name: 'Edit', exact: true }).first().click({ timeout: 90000 });
await page.waitForTimeout(2500);
const locHead = main.getByText('Location', { exact: true }).first();
const city = main.locator('input[placeholder="Search cities"]').first();
if (!(await city.isVisible().catch(() => false))) { await locHead.click(); await page.waitForTimeout(1500); }
console.log('BUG-57 city disabled:', await city.isDisabled(), 'value:', await city.inputValue());
await mark(city.locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root") or contains(@class,"MuiAutocomplete-root")][1]'));
await page.screenshot({ path: 'screenshots/fixed/BUG-57-fixed-city-locked-in-edit.png' });

// BUG-66: Testing season 3 > Excursion > Allotment - no active contract -> Add allotment disabled + explanation
await page.goto('/suppliers/18/products');
await page.getByText('Choose a product type').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Excursion', exact: true }).last().click();
await page.getByRole('tab', { name: 'Allotment' }).last().click(); await page.waitForTimeout(3000);
const add = main.getByRole('button', { name: 'Add allotment' }).last();
console.log('BUG-66 add allotment enabled:', await add.isEnabled());
const msg = main.getByText(/no active contract yet/).first();
await mark(msg); await mark(add);
await page.screenshot({ path: 'screenshots/fixed/BUG-66-fixed-allotment-needs-contract.png' });

// BUG-78: Edit Testing season 3 > first document slot <- 6 MB PDF -> refused with a message, nothing uploaded
await page.goto('/suppliers/18/overview');
await page.getByRole('button', { name: 'Edit', exact: true }).first().click({ timeout: 90000 });
await page.locator('main input[type=file]').first().waitFor({ state: 'attached', timeout: 60000 });
const head = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n');
const big = Buffer.concat([head, Buffer.alloc(6 * 1024 * 1024 - head.length, 32), Buffer.from('\n%%EOF\n')]);
await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto-6mb.pdf', mimeType: 'application/pdf', buffer: big });
await page.waitForTimeout(2500);
const tooBig = page.getByText(/Files must be 5 MB or smaller|5 MB or smaller/).first();
console.log('BUG-78 message:', await tooBig.innerText().catch(() => 'NOT FOUND'));
await mark(tooBig);
await page.screenshot({ path: 'screenshots/fixed/BUG-78-fixed-6mb-file-refused.png' });
console.log('requests:', log.join(' | ') || 'none');
await browser.close();
