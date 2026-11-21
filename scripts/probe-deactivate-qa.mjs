// QA DATA ONLY: deactivate ONE "QA Auto ..." record and print the server answer + any message (why does cleanup fail?)
//   node scripts/probe-deactivate-qa.mjs /states "QA Auto State QLLSSK Edge Co Test"
import { open } from './probe-lib.mjs';
const [path, name] = process.argv.slice(2);
if (!/^QA Auto /i.test(name)) throw new Error('only QA Auto records');
const log = [];
const { browser, page } = await open({ allowWrites: true, log });
await page.goto('/' + path.replace(/^\/+/, ''));   // pass the path without a leading slash in Git Bash
await page.locator('tbody tr').first().waitFor({ timeout: 90000 });
await page.locator('thead th:has(input[placeholder="Search name"])').first().click({ position: { x: 30, y: 15 }, force: true });
const box = page.locator('main thead input[placeholder="Search name"]').first();
await box.waitFor({ state: 'visible' }); await box.fill(name); await page.waitForTimeout(3000);
// only an ACTIVE row (switch ON) - never touch an inactive one (that would REACTIVATE it)
const row = page.locator('tbody tr').filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.locator('input[type=checkbox]:checked') }).first();
if (!(await row.count())) { console.log('no ACTIVE row named', name); await browser.close(); process.exit(0); }
await row.locator('input[type=checkbox]').click();
const pop = page.locator('.swal2-popup:visible'); await pop.waitFor();
console.log('popup:', (await pop.innerText()).replace(/\s+/g, ' '));
await pop.getByRole('button', { name: /^Yes/ }).click();
const texts = [];
for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); for (const t of await page.locator('[role=alert], .MuiAlert-message, .swal2-popup:visible, .Toastify__toast, .notistack-SnackbarContainer').allInnerTexts()) if (t.trim() && !texts.includes(t.trim())) texts.push(t.trim()); }
console.log('messages:', JSON.stringify(texts));
console.log('switch now checked:', await row.locator('input[type=checkbox]').isChecked().catch(() => '?'));
if (process.env.SHOT) {
  await row.evaluate(e => { e.style.outline = '3px solid #dc2626'; }).catch(() => {});
  await page.evaluate(t => { const d = document.createElement('div'); d.textContent = t; Object.assign(d.style, { position: 'fixed', top: '12px', right: '12px', zIndex: 2147483647, background: '#dc2626', color: '#fff', font: 'bold 15px sans-serif', padding: '6px 12px', borderRadius: '6px', maxWidth: '760px' }); document.body.appendChild(d); },
    `"Yes, deactivate" confirmed -> server: ${log.filter(l => l.startsWith('  ->')).pop()?.trim().slice(0, 120)} | no message shown, switch still ON`);
  await page.screenshot({ path: process.env.SHOT });
}
console.log(log.join('\n'));
await browser.close();
