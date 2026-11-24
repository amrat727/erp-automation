// Helper (not a test): creates (mode=create) or deactivates (mode=off) the QA Contact Type "QA Auto Contact Type"
// in Core > Application > Role - needed by the supplier contact checks (KAN-78). User OK 24 Nov 2026.
//   node scripts/probes/qa-contact-role.mjs create|off
import { open } from '../lib/probe-lib.mjs';

const MODE = process.argv[2] || 'create';
const NAME = 'QA Auto Contact Type';
const log = [];
const { browser, page } = await open({ log, allowWrites: true });
page.setDefaultTimeout(30000);
await page.goto('/contacttype');
await page.locator('tbody tr').first().waitFor({ timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);
// the list is paged - search for the name (the search box opens when the column title is clicked)
const box = page.locator('main thead input[placeholder="Search name"]').first();
if (!(await box.isVisible().catch(() => false))) await page.locator('main thead th').first().click({ position: { x: 30, y: 15 }, force: true });
await box.fill(NAME).catch(() => {});
await page.waitForTimeout(3000);
const row = page.locator('tbody tr').filter({ hasText: NAME });
if (MODE === 'create') {
  if (await row.count()) {
    const sw = row.first().locator('input[type=checkbox]');
    if (!(await sw.isChecked())) { await sw.click(); await page.getByRole('button', { name: /^Yes, Activate$/i }).click().catch(() => {}); }
    console.log('exists - active now');
  } else {
    await page.getByRole('button', { name: /^Add Role$/i }).click();
    const d = page.getByRole('dialog').last();
    await d.getByText(/^Name\s*\*?$/).first().locator('xpath=following::input[1]').fill(NAME);
    await d.getByRole('button', { name: /^Save$/i }).click();
    await page.waitForTimeout(3000);
    console.log('created');
  }
} else {
  const sw = row.first().locator('input[type=checkbox]');
  if (await sw.isChecked()) { await sw.click(); await page.getByRole('button', { name: /^Yes, Deactivate$/i }).click(); await page.waitForTimeout(3000); }
  console.log('deactivated');
}
console.log('server:', log.join(' | ').slice(0, 400));
await browser.close();
