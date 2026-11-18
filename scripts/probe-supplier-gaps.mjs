// Helper (not a test): READ-ONLY look at the Supplier screens not yet covered by tests.
// Products tab, row actions (contacts / currencies / bank accounts), Columns button, Content tab.
// Run:  node scripts/probe-supplier-gaps.mjs <outDir> [supplierId]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'supplier-gaps';
const ID = process.argv[3] ?? '18';
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
let n = 0;
const vis = async () => ({
  buttons: (await page.getByRole('button').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
  buttonLabels: await page.getByRole('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label')).filter(Boolean)),
  inputs: await page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => [e.type, e.placeholder, e.disabled ? 'disabled' : 'EDITABLE', e.maxLength > 0 ? 'max' + e.maxLength : '', (e.value || '').slice(0, 30)].filter(Boolean).join(' | '))),
  rows: (await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 160)),
  dialogs: await page.getByRole('dialog').allInnerTexts().catch(() => []),
  menuItems: await page.getByRole('menuitem').allInnerTexts().catch(() => []),
  checks: await page.getByRole('checkbox').evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || e.closest('label')?.innerText || '?') + '=' + e.checked)).catch(() => []),
});
const snap = async label => {
  await page.waitForTimeout(2500);
  out.steps.push({ label, url: new URL(page.url()).pathname, ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label);
};
const tryStep = async (label, fn) => { try { await fn(); await snap(label); } catch (e) { out.steps.push({ label, error: String(e).slice(0, 300) }); console.log('FAILED', label); } };

try {
  // ---- list: Columns button
  await page.goto('/suppliers');
  await page.getByRole('heading', { name: /^Suppliers/ }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(4000);
  await tryStep('list columns menu', () => page.getByRole('button', { name: 'Columns' }).click());
  await page.keyboard.press('Escape');

  // ---- supplier tabs
  await page.goto(`/suppliers/${ID}/overview`);
  await page.getByRole('tab', { name: 'Overview' }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(4000);

  await tryStep('products tab', async () => { await page.getByRole('tab', { name: 'Products' }).click(); await page.waitForTimeout(3000); });
  await tryStep('products edit dialog', () => page.getByRole('button', { name: 'Edit products offered' }).click());
  await page.keyboard.press('Escape');

  await tryStep('contacts tab', async () => { await page.getByRole('tab', { name: 'Contacts' }).click(); await page.waitForTimeout(3000); });
  // row action: click first row's last cell / any kebab
  await tryStep('contacts row click', async () => { await page.locator('main tbody tr:visible').first().click(); });
  await page.keyboard.press('Escape');
  await tryStep('contacts row menu', async () => { await page.locator('main tbody tr:visible').first().getByRole('button').last().click(); });
  await page.keyboard.press('Escape');

  await tryStep('financials tab', async () => { await page.getByRole('tab', { name: 'Financials' }).click(); await page.waitForTimeout(3000); });
  await tryStep('financials currency row click', async () => { await page.locator('main tbody tr:visible').first().click(); });
  await page.keyboard.press('Escape');
  await tryStep('financials currency row menu', async () => { await page.locator('main tbody tr:visible').first().getByRole('button').last().click(); });
  await page.keyboard.press('Escape');

  await tryStep('content tab', async () => { await page.getByRole('tab', { name: 'Content' }).click(); await page.waitForTimeout(3000); });
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
