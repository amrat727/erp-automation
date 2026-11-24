// Helper (not a test): READ-ONLY - the words in the Status / Active list filters (KAN-105 / KAN-106). Every save is BLOCKED.
//   node scripts/probes/probe-filter-words.mjs
import { open, SHOTS } from '../lib/probe-lib.mjs';

const { browser, page } = await open({});
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
for (const [name, path] of [['Supplier', '/suppliers'], ['Agent', '/agents'], ['Core Country', '/countries'], ['Package', '/packages'], ['Quotes', '/quotes'], ['Reservation', '/reservations']]) {
  await page.goto(path);
  await page.locator('tbody tr').first().waitFor({ timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const heads = await page.locator('main thead th').evaluateAll(ths => ths.map(th => ({ text: (th.textContent || '').trim().slice(0, 30), combo: !!th.querySelector('[role=combobox]'), input: !!th.querySelector('input') })));
  const out = [];
  const ths = page.locator('main thead th').filter({ hasText: /^(Status|Active)/ });
  for (let i = 0; i < await ths.count(); i++) {
    // the filter is revealed by clicking the column title, then its dropdown opens
    await ths.nth(i).click({ position: { x: 30, y: 15 }, force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await ths.nth(i).locator('[role=combobox]').first().click().catch(() => {});
    await page.waitForTimeout(800);
    out.push(clean(await ths.nth(i).innerText()).split(' ')[0] + ': ' + JSON.stringify((await page.locator('[role=option], [role=listbox] li').allInnerTexts()).map(clean)));
    await page.keyboard.press('Escape');
  }
  console.log(`${name}: headers=${JSON.stringify(heads.map(h => h.text + (h.combo ? '[combo]' : '')))} | dropdowns=${JSON.stringify(out)}`);
  await page.screenshot({ path: `${SHOTS}/filter-${name.replace(' ', '-')}.png` });
}
await browser.close();
