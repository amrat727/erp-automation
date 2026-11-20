// Helper (not a test): READ-ONLY - reservation Itinerary: "Change status" options and the service card menu (cancel?); saves BLOCKED and printed.
import { open, SHOTS } from './probe-lib.mjs';
const log = [];
const { browser, page } = await open({ log });
const id = process.argv[2] || '4';
await page.goto(`/reservations/${id}`);
await page.getByRole('tab', { name: /^Itinerary/ }).first().click({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.locator('main').getByRole('button', { name: 'Change status' }).click();
await page.waitForTimeout(1500);
const pop = page.locator('.MuiDialog-paper:visible, .MuiPopover-paper:visible, .MuiMenu-paper:visible').last();
console.log('CHANGE STATUS', (await pop.innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 1200));
console.log('OPTIONS', JSON.stringify(await page.getByRole('option').allInnerTexts()), JSON.stringify(await page.getByRole('menuitem').allInnerTexts()));
await page.screenshot({ path: `${SHOTS}/res-change-status.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(800);
// the service card: click it, look for a menu / cancel
const card = page.locator('main').getByText('PH261120-7KSVJS', { exact: false }).first();
await card.click(); await page.waitForTimeout(2500);
const d = page.locator('.MuiDialog-paper:visible, .MuiDrawer-anchorRight .MuiDrawer-paper:visible').last();
console.log('SERVICE', (await d.innerText().catch(() => 'none')).replace(/\s+/g, ' ').slice(0, 1500));
console.log('SERVICE BUTTONS', JSON.stringify((await d.locator('button:visible').evaluateAll(b => b.map(x => x.innerText.trim() || x.getAttribute('aria-label')))).filter(Boolean)));
await page.screenshot({ path: `${SHOTS}/res-service.png` });
console.log(log.join('\n'));
await browser.close();
