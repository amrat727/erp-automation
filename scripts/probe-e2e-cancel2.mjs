// Helper (not a test): READ-ONLY - what "Cancelled" would do: reservation Change status and the service's status chip. Saves BLOCKED and printed.
import { open, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '4';
const dump = async (label) => {
  await page.waitForTimeout(2000);
  const d = page.locator('.MuiDialog-paper:visible').last();
  console.log(label, (await d.innerText().catch(() => 'no dialog')).replace(/\s+/g, ' ').slice(0, 900));
  console.log(label + ' buttons', JSON.stringify((await d.locator('button:visible').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean)));
};
await page.goto(`/reservations/${id}`);
await page.getByRole('tab', { name: /^Itinerary/ }).first().click({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.locator('main').getByRole('button', { name: 'Change status' }).click();
await page.getByRole('menuitem', { name: 'Cancelled', exact: true }).click();
await dump('RES-CANCEL');
await page.screenshot({ path: `${SHOTS}/res-cancel-dialog.png` });
const confirm = page.locator('.MuiDialog-paper:visible').last().getByRole('button', { name: /^(Yes|Confirm|Cancel (booking|reservation)|Change|Apply|Save)/ });
if (await confirm.count()) { console.log('pressing', await confirm.first().innerText()); await confirm.first().click(); await page.waitForTimeout(2500); await dump('AFTER'); }
console.log('REQUESTS\n' + log.join('\n'));
await browser.close();
