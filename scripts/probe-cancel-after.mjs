// Helper (not a test): READ-ONLY evidence - a reservation set to Cancelled: does the hotel line and the money follow?
import { open } from './probe-lib.mjs';
const { browser, page } = await open();
const id = process.argv[2] || '7';
const grab = async (tab, file) => {
  await page.goto(`/reservations/${id}`);
  await page.getByRole('tab', { name: tab }).first().click({ timeout: 90000 });
  await page.waitForTimeout(3000);
  const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  console.log(`== ${tab}: ` + t.slice(t.indexOf('Private') + 8, t.indexOf('Private') + 900));
  if (file) await page.screenshot({ path: file });
};
await grab(/^Itinerary/, 'screenshots/bugs/BUG-131-1-cancelled-but-service-confirmed.png');
await grab(/^Accounting/, 'screenshots/bugs/BUG-131-2-cancelled-but-agent-still-owes.png');
await browser.close();
