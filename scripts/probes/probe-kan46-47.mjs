// Helper (not a test): READ-ONLY checks for KAN-46 (BUG-28: re-activating has no confirmation) and
// KAN-47 (BUG-29: form labels not linked to inputs). Every save is BLOCKED by probe-lib - nothing can change.
//   node scripts/probes/probe-kan46-47.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const OUT = 'screenshots/sahil'; fs.mkdirSync(OUT, { recursive: true });
const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();

// KAN-46: an INACTIVE QA record on States -> click its switch (the save is blocked) -> is there a popup?
await page.goto('/states');
await page.locator('tbody tr').first().waitFor({ timeout: 90000 });
await page.waitForTimeout(2000);
const off = page.locator('tbody tr').filter({ hasText: /QA Auto State/ }).filter({ has: page.locator('input[type=checkbox]:not(:checked)') }).first();
console.log('KAN-46 row:', clean(await off.locator('td').first().innerText()));
const before = log.length;
await off.locator('input[type=checkbox]').click();
await page.waitForTimeout(2000);
const popup = page.locator('.swal2-popup, [role=dialog]').last();
const shown = await popup.isVisible().catch(() => false);
console.log(`KAN-46: popup on re-activate = ${shown}${shown ? ' | ' + clean(await popup.innerText()).slice(0, 200) : ''} | save attempts blocked = ${log.length - before}`);
await page.screenshot({ path: `${OUT}/KAN-46-reactivate-popup.png` });
if (shown) await popup.getByRole('button', { name: /cancel/i }).first().click().catch(() => {});

// KAN-47: Add State form - can the inputs be found by their label (label linked to the input)?
await page.goto('/states');
await page.getByRole('button', { name: /^Add State$/i }).click({ timeout: 90000 });
const dlg = page.getByRole('dialog').last();
await dlg.waitFor();
for (const l of ['Name', 'Country']) {
  const n = await dlg.getByLabel(new RegExp(`^${l}`)).count();
  console.log(`KAN-47: Add State "${l}" -> inputs found by label: ${n}`);
}
const unlinked = await dlg.locator('input:not([type=hidden])').evaluateAll(es => es.filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).length);
console.log(`KAN-47: inputs without a linked label = ${unlinked}`);
await page.screenshot({ path: `${OUT}/KAN-47-add-state-labels.png` });
await page.keyboard.press('Escape');
console.log('writes blocked:', log.length);
await browser.close();
