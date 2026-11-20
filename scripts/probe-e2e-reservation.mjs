// Helper (not a test): READ-ONLY - a booked reservation: each tab's text and buttons; looks for cancel / payment actions (saves BLOCKED).
import { open, text, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '4';
await page.goto(`/reservations/${id}`);
await page.getByRole('tab', { name: /^Summary/ }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
const tabs = (await page.getByRole('tab').allInnerTexts()).filter(t => !/^Reservation|^Package|^Product/.test(t));
console.log('TABS', JSON.stringify(tabs));
for (const t of tabs) {
  await page.getByRole('tab', { name: t, exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  const s = await text(page);
  console.log(`\n== ${t}\n` + s.replace(/^.*?Reservations? /, '').slice(0, 1400));
  console.log('BUTTONS', JSON.stringify((await page.locator('main button:visible').evaluateAll(b => b.map(x => x.innerText.trim() || x.getAttribute('aria-label')))).filter(Boolean).slice(-30)));
}
await page.getByRole('tab', { name: /^Itinerary/ }).first().click(); await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/res-${id}-itinerary.png`, fullPage: true });
await browser.close();
