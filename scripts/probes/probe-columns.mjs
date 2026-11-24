// Helper (not a test): READ-ONLY - lists the columns each list offers under "Columns" (shown and hidden), to find
// creation dates for the Dashboard checks. Every save is BLOCKED.
//   node scripts/probes/probe-columns.mjs
import { open } from '../lib/probe-lib.mjs';

const { browser, page } = await open({});
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
for (const [name, path] of [['Reservations', '/reservations'], ['Agents', '/agents'], ['Suppliers', '/suppliers'], ['Quotes', '/quotes'], ['Contracts', '/contracts'], ['Feedback', '/feedback']]) {
  await page.goto(path);
  await page.locator('main').waitFor(); await page.waitForTimeout(5000);
  const btn = page.getByRole('button', { name: /^Columns$/i }).filter({ visible: true }).first();
  if (!(await btn.isVisible().catch(() => false))) { console.log(`${name}: no Columns button | ${clean(await page.locator('main').innerText()).slice(0, 200)}`); continue; }
  await btn.click(); await page.waitForTimeout(1500);
  const panel = page.locator('.MuiPopover-paper, [role=menu], [role=dialog], .MuiPaper-root').filter({ visible: true }).last();
  console.log(`${name}: ${clean(await panel.innerText()).slice(0, 400)}`);
  await page.keyboard.press('Escape');
}
await browser.close();
