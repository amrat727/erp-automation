// read-only: screenshot of the Core > Resource menu (plural "Resource Types" / "Assets" next to "Personnel")
import { open } from './probe-lib.mjs';
const { browser, page } = await open({ log: [] });
await page.goto('/dashboard');
await page.getByRole('button', { name: 'Core', exact: true }).click();
await page.getByRole('button', { name: 'Resource', exact: true }).click();
await page.waitForTimeout(800);
for (const n of ['Resource Types', 'Assets']) await page.getByRole('button', { name: n, exact: true }).evaluate(e => { e.style.outline = '3px solid #dc2626'; });
await page.getByRole('button', { name: 'Personnel', exact: true }).evaluate(e => { e.style.outline = '3px solid #16a34a'; });
await page.screenshot({ path: 'screenshots/revalidation/BUG-147-resource-menu-plural.png' });
await browser.close();
