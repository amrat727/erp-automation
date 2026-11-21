// read-only: Asset list showing the duplicates saved by the 21 Nov core rerun (TC-ASSET-04/05/06, run tag QPVPVL)
import { open } from './probe-lib.mjs';
const { browser, page } = await open({ log: [] });
await page.goto('/resources/assets');
await page.locator('tbody tr').first().waitFor({ timeout: 90000 });
await page.locator('thead th:has(input[placeholder="Search name"])').first().click({ position: { x: 30, y: 15 }, force: true });
const box = page.locator('main thead input[placeholder="Search name"]').first();
await box.waitFor({ state: 'visible' }); await box.fill('QPVPVL'); await page.waitForTimeout(3000);
const names = (await page.locator('tbody tr td:nth-child(1)').allInnerTexts()).map(s => s.trim());
console.log(JSON.stringify(names));
for (const r of await page.locator('tbody tr').filter({ hasText: /Duplicate|QA AUTO/ }).all()) await r.evaluate(e => { e.style.outline = '3px solid #dc2626'; });
await page.screenshot({ path: 'screenshots/revalidation/BUG-148-asset-duplicates-saved.png' });
await browser.close();
