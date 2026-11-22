// Helper (not a test): READ-ONLY look at what changed on the 22 Nov 2026 core build (every save is BLOCKED).
//   node scripts/probes/probe-core-22nov.mjs
import { open, text, SHOTS } from '../lib/probe-lib.mjs';

const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(30000);
const shot = n => page.screenshot({ path: `${SHOTS}/p22-${n}.png` });
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log(`${name}: ERROR ${String(e).split('\n')[0]}`); } };
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();

await step('Country', async () => {
  await page.goto('/countries'); await page.getByRole('button', { name: 'Add Country' }).click({ timeout: 90000 });
  const dlg = page.getByRole('dialog').filter({ hasText: 'Add Country' });
  const box = dlg.getByRole('combobox');
  await box.click(); await page.waitForTimeout(1500);
  console.log('Country: options on click =', await page.getByRole('option').count());
  await box.fill('Ind'); await page.waitForTimeout(1500);
  console.log('Country: options for "Ind" =', (await page.getByRole('option').allInnerTexts()).join(' | '));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  // active filter
  await page.goto('/countries'); await page.waitForTimeout(4000);
  console.log('Country: header =', clean(await page.locator('thead').innerText()));
  await shot('country-list');
});

await step('FeedbackQ', async () => {
  await page.goto('/feedback-questions'); await page.waitForTimeout(4000);
  console.log('FBQ page:', (await text(page)).slice(0, 400));
  await page.getByRole('button', { name: 'Add Question' }).click();
  await page.waitForTimeout(2000);
  const dlg = page.getByRole('dialog').last();
  console.log('FBQ dialog:', clean(await dlg.innerText()).slice(0, 1500));
  console.log('FBQ dialog buttons:', (await dlg.getByRole('button').allInnerTexts()).map(clean).join(' | '));
  await shot('fbq-add');
  await page.keyboard.press('Escape');
});

await step('Users', async () => {
  await page.goto('/users'); await page.waitForTimeout(5000);
  console.log('Users thead:', clean(await page.locator('thead').first().innerText()), '| inputs:', await page.locator('thead input').evaluateAll(es => es.map(e => e.placeholder)));
  await shot('users');
});

await step('Status audit', async () => {
  await page.goto('/status'); await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Audit history' }).click();
  await page.waitForTimeout(3000);
  console.log('Status audit:', clean(await page.getByRole('dialog').last().innerText()).slice(0, 900));
  await shot('status-audit');
  await page.keyboard.press('Escape');
});

await step('State audit sahil', async () => {
  await page.goto('/states'); await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Audit history' }).click();
  const dlg = page.getByRole('dialog').last(); await page.waitForTimeout(3000);
  for (let i = 0; i < 40; i++) { await dlg.evaluate(d => d.querySelectorAll('*').forEach(e => { if (e.scrollHeight > e.clientHeight + 20) e.scrollTop = e.scrollHeight; })); await page.waitForTimeout(400); }
  const t = clean(await dlg.innerText());
  console.log('State audit: "sahil " entries =', (t.match(/\bsahil (created|updated|deactivated|reactivated)/g) || []).length, '| "Sahil Chauhan" =', (t.match(/Sahil Chauhan/g) || []).length, '| tail:', t.slice(-300));
  await shot('state-audit-bottom');
  await page.keyboard.press('Escape');
});

await step('Province popup', async () => {
  await page.goto('/provinces'); await page.waitForTimeout(5000);
  const rows = page.locator('tbody tr').filter({ has: page.locator('input[type=checkbox]') });
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const sw = rows.nth(i).locator('input[type=checkbox]');
    if (await sw.isChecked()) {                     // only a switch that is ON: clicking it opens the deactivate popup
      console.log('Province: active row =', clean(await rows.nth(i).locator('td').first().innerText()));
      await sw.click(); await page.waitForTimeout(1500);
      const dlg = page.getByRole('dialog').last();
      console.log('Province popup:', clean(await dlg.innerText()));
      await shot('province-popup');
      await dlg.getByRole('button', { name: /cancel/i }).click();
      break;
    }
  }
});

console.log('writes blocked:', log.length);
await browser.close();
