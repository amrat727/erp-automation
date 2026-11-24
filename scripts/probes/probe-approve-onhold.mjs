// Helper (not a test): tries to APPROVE the QA contract "QA Auto Contract PPTKRQ USD" of the On hold supplier
// "Testing season 3" (id 18) and prints the server answer + any message (KAN-115 / KAN-73). Writes are allowed here
// (QA contract only); the contract is deactivated afterwards by the normal supplier cleanup.
//   node scripts/probes/probe-approve-onhold.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const log = [];
const { browser, page } = await open({ log, allowWrites: true });
page.setDefaultTimeout(30000);
const NAME = 'QA Auto Contract PPTKRQ USD';
await page.goto('/suppliers/18/products');
await page.waitForTimeout(6000);
await page.getByRole('button', { name: /^Hotel/ }).first().click().catch(() => {});
await page.waitForTimeout(3000);
await page.getByRole('tab', { name: /Contract/i }).first().click().catch(() => {});
await page.waitForTimeout(4000);
const row = page.locator('tbody tr').filter({ hasText: NAME }).first();
console.log('row before:', (await row.innerText().catch(() => 'NOT FOUND')).replace(/\s+/g, ' ').slice(0, 160));
await row.getByRole('button', { name: new RegExp(`^Approve`) }).first().click();
await page.waitForTimeout(2500);
const dlg = page.getByRole('dialog').last();
if (await dlg.isVisible().catch(() => false)) {
  console.log('dialog:', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 300));
  await dlg.getByRole('button', { name: /Approve|Yes|Confirm/ }).last().click().catch(() => {});
}
await page.waitForTimeout(4000);
const msgs = (await page.locator('[role=alert], .MuiAlert-message, .Toastify__toast, .swal2-popup').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
console.log('messages:', JSON.stringify(msgs));
console.log('row after:', (await row.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160));
console.log('server:', log.join(' | ').slice(0, 600));
fs.mkdirSync('screenshots/sahil', { recursive: true });
await page.screenshot({ path: 'screenshots/sahil/KAN-115-approve-on-hold-supplier.png' });
await browser.close();
