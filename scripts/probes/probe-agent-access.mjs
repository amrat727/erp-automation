// Helper (not a test): READ-ONLY - which products the QA B2B agent AG-00035 has access to in the ERP (every save is BLOCKED).
//   node scripts/probes/probe-agent-access.mjs
import { open, SHOTS } from '../lib/probe-lib.mjs';

const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
await page.goto('/agents/35'); await page.waitForTimeout(6000);
console.log('header:', clean(await page.locator('main').innerText()).slice(0, 160));
console.log('URL', page.url());
for (const tab of ['Access', 'Products']) {
  const t = page.getByRole('tab', { name: new RegExp(tab) }).first();
  if (await t.isVisible().catch(() => false)) { await t.click(); await page.waitForTimeout(2500); }
}
const txt = clean(await page.locator('main').innerText());
const i = txt.search(/Products/);
console.log('Products section:', txt.slice(i, i + 900));
console.log('switches:', await page.locator('main [role=switch], main input[type=checkbox]').evaluateAll(es => es.map(e => `${e.getAttribute('aria-label') || e.closest('label,div')?.textContent?.trim().slice(0, 30)}=${e.checked}`).slice(0, 30)));
// Portal menus: open its Edit (read-only, Escape closes, saves are blocked)
const pm = page.getByText('Portal menus', { exact: true }).first().locator('xpath=ancestor::*[.//button][1]').getByRole('button', { name: /Edit/ }).first();
if (await pm.isVisible().catch(() => false)) { await pm.click(); await page.waitForTimeout(2000);
  const d = page.getByRole('dialog').last(); const txt2 = (await d.isVisible().catch(() => false)) ? await d.innerText() : await page.locator('body').innerText(); const k = clean(txt2); console.log('Portal menus view:', k.slice(Math.max(0, k.search(/Portal menus|Menus/)), Math.max(0, k.search(/Portal menus|Menus/)) + 1200));
  await page.screenshot({ path: `${SHOTS}/agent35-portal-menus.png` });
  await page.keyboard.press('Escape'); }
await page.screenshot({ path: `${SHOTS}/agent35-access.png`, fullPage: true });
console.log('writes blocked:', log.length);
await browser.close();
