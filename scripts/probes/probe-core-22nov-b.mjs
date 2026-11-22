// Helper (not a test): READ-ONLY follow-up for the 22 Nov 2026 core build (every save is BLOCKED).
//   node scripts/probes/probe-core-22nov-b.mjs
import { open, SHOTS } from '../lib/probe-lib.mjs';

const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(30000);
const shot = n => page.screenshot({ path: `${SHOTS}/p22-${n}.png` });
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`${name}: ERROR ${String(e).split('\n')[0]}`); } };
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();

await step('State audit last page', async () => {
  await page.goto('/states'); await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Audit history' }).click();
  const dlg = page.getByRole('dialog').last(); await page.waitForTimeout(3000);
  let sahil = 0;
  for (let i = 0; i < 20; i++) {
    const t = clean(await dlg.innerText());
    sahil += (t.match(/\bsahil (created|updated|deactivated|reactivated)/g) || []).length;
    const pageInfo = (t.match(/Showing [\d–-]+ of \d+/) || [''])[0];
    const next = dlg.getByRole('button').last();
    if (await next.isDisabled().catch(() => true)) { console.log('State audit: last page', pageInfo, '| old "sahil" entries seen =', sahil, '| tail:', t.slice(-250)); break; }
    await next.click(); await page.waitForTimeout(1500);
  }
  await shot('state-audit-last');
  await page.keyboard.press('Escape');
});

await step('Province popup', async () => {
  await page.goto('/provinces'); await page.waitForTimeout(5000);
  const on = page.locator('tbody tr input[type=checkbox]:checked');
  console.log('Province: switches ON on page 1 =', await on.count());
  if (await on.count()) {
    await on.first().click(); await page.waitForTimeout(1500);
    const dlg = page.getByRole('dialog').last();
    console.log('Province popup:', clean(await dlg.innerText()));
    await shot('province-popup');
    await dlg.getByRole('button', { name: /cancel/i }).click();
  }
});

await step('FBQ dropdowns', async () => {
  await page.goto('/feedback-questions'); await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Add Question' }).click(); await page.waitForTimeout(2000);
  const dlg = page.getByRole('dialog').last();
  console.log('FBQ comboboxes:', await dlg.getByRole('combobox').evaluateAll(es => es.map(e => e.getAttribute('aria-label') || e.id || e.textContent)));
  for (const lbl of ['Answer', 'Asks about']) {
    const cb = dlg.getByText(new RegExp(`^${lbl}\\s*\\*?$`)).first().locator('xpath=following::*[@role="combobox"][1]');
    await cb.click(); await page.waitForTimeout(1000);
    console.log(`FBQ ${lbl} options:`, (await page.getByRole('option').allInnerTexts()).map(clean).join(' | '));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
  await dlg.getByText('Hindi').first().click().catch(() => {}); await page.waitForTimeout(1000);
  console.log('FBQ after Hindi tab:', clean(await dlg.innerText()).slice(0, 600));
  await shot('fbq-hindi');
  // choose "Choice" and see if a choices field appears
  const before = await dlg.locator('input, textarea').count();
  const cb = dlg.getByText(/^Answer\s*\*?$/).first().locator('xpath=following::*[@role="combobox"][1]');
  await cb.click(); await page.getByRole('option', { name: /Choice/ }).first().click().catch(() => {}); await page.waitForTimeout(1000);
  console.log('FBQ Choice: inputs before/after =', before, await dlg.locator('input, textarea').count(), '|', clean(await dlg.innerText()).slice(0, 500));
  await shot('fbq-choice');
});

console.log('writes blocked:', log.length);
await browser.close();
