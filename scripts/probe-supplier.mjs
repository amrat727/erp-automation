// Helper (not a test): explores the Supplier module READ-ONLY (every save is blocked).
// Records the list, filters, the Add form (and its empty-save messages), and every tab/section
// of an existing supplier, with a screenshot of each step.
// Run:  node scripts/probe-supplier.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'supplier-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !r.request().url().includes('negotiate')) { sent.push(`${m} ${r.request().url()}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
const clean = s => s.replace(/[​]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
let n = 0;
const snap = async (label, scope) => {
  await page.waitForTimeout(2500);
  const root = scope ?? page.locator('main');
  const step = {
    label, url: new URL(page.url()).pathname,
    text: clean(await root.innerText().catch(() => '')).slice(0, 8000),
    buttons: (await root.getByRole('button').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean),
    tabs: (await root.getByRole('tab').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean),
    columns: (await root.getByRole('columnheader').allInnerTexts().catch(() => [])).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
    inputs: await root.locator('input, textarea, select').evaluateAll(els => els.map(e => [e.tagName.toLowerCase(), e.type, e.placeholder, e.getAttribute('role'), e.required ? 'required' : '', e.maxLength > 0 ? 'max' + e.maxLength : '', e.disabled ? 'disabled' : '', (e.value || '').slice(0, 40)].filter(Boolean).join(' '))).catch(() => []),
  };
  out.steps.push(step);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label, step.url);
  return step;
};

try {
  // 1) list via the menu
  await page.goto('/dashboard');
  await page.locator('nav, aside').first().getByRole('button', { name: 'Supplier', exact: true }).first().click({ timeout: 90_000 });
  await page.waitForTimeout(8000);
  await snap('list');

  // filters in the table header
  for (const cb of await page.locator('main thead [role=combobox], main thead select').all()) {
    await cb.click().catch(() => {});
    await page.waitForTimeout(1200);
    out.steps.push({ label: 'filter options', options: await page.getByRole('option').allInnerTexts() });
    await page.keyboard.press('Escape');
  }

  // 2) Add form + empty save
  const add = page.locator('main').getByRole('button', { name: /^(Add|New|Create)/ }).first();
  if (await add.count()) {
    await add.click();
    await page.waitForTimeout(4000);
    const dlg = (await page.getByRole('dialog').count()) ? page.getByRole('dialog').last() : page.locator('main');
    await snap('add form', dlg);
    for (const t of await dlg.getByRole('tab').all()) { await t.click().catch(() => {}); await snap('add tab ' + (await t.innerText()).trim(), dlg); }
    const save = dlg.getByRole('button', { name: /^(Save|Create|Submit|Next)/ }).first();
    if (await save.count()) { await save.click(); await snap('add empty save', dlg); }
    await page.keyboard.press('Escape');
    await page.goto(new URL(out.steps[0].url, 'https://x').pathname);
    await page.waitForTimeout(6000);
  }

  // 3) open the first existing supplier and walk its tabs / sections
  const firstRow = page.locator('main tbody tr').first();
  if (await firstRow.count()) {
    await firstRow.locator('td').nth(1).click().catch(() => firstRow.click());
    await page.waitForTimeout(6000);
    const scope = (await page.getByRole('dialog').count()) ? page.getByRole('dialog').last() : page.locator('main');
    await snap('open existing', scope);
    const tabNames = (await scope.getByRole('tab').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    for (const name of tabNames) {
      await scope.getByRole('tab', { name, exact: true }).first().click().catch(() => {});
      await snap('tab ' + name, scope);
      // open each "Add ..." inside the tab to see its sub-form, then close it
      for (const b of await scope.getByRole('button', { name: /^(Add|New)\b/ }).all()) {
        const label = (await b.innerText()).trim();
        await b.click().catch(() => {});
        await page.waitForTimeout(2500);
        if (await page.getByRole('dialog').count()) {
          const d = page.getByRole('dialog').last();
          await snap(`tab ${name} > ${label}`, d);
          const sv = d.getByRole('button', { name: /^(Save|Create)/ }).first();
          if (await sv.count()) { await sv.click(); await snap(`tab ${name} > ${label} empty save`, d); }
          await page.keyboard.press('Escape');
          await d.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
        }
      }
    }
  }
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
