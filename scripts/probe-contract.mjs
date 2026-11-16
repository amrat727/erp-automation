// Helper (not a test): READ-ONLY look for the Contract screens under a supplier's products.
// Run:  node scripts/probe-contract.mjs <outDir> [supplierId]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract';
const ID = process.argv[3] ?? '18';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
const gets = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}`); return r.abort(); }
  if (/contract/i.test(r.request().url())) gets.push(`${m} ${r.request().url()}`);
  return r.continue();
});
const page = await ctx.newPage();
const out = { steps: [] };
let n = 0;
const vis = async () => ({
  headings: (await page.getByRole('heading').allInnerTexts()).map(s => s.trim()).filter(Boolean),
  tabs: (await page.getByRole('tab').allInnerTexts()).map(s => s.trim()),
  links: (await page.locator('a:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '') + ' -> ' + e.getAttribute('href')))).filter(s => !s.startsWith(' ->')),
  buttons: (await page.locator('main button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
  inputs: await page.locator('main input:visible, main textarea:visible').evaluateAll(els => els.map(e => [e.type, e.placeholder, e.disabled ? 'disabled' : 'EDITABLE', e.maxLength > 0 ? 'max' + e.maxLength : '', (e.value || '').slice(0, 30)].filter(Boolean).join(' | '))),
  headers: (await page.locator('main th:visible').allInnerTexts()).map(s => s.trim()),
  rows: (await page.locator('main tbody tr:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 200)),
  dialogs: await page.getByRole('dialog').allInnerTexts().catch(() => []),
  contractText: (await page.locator('main :visible').getByText(/contract/i).allInnerTexts().catch(() => [])).map(s => s.replace(/\s+/g, ' ').slice(0, 120)).slice(0, 30),
});
const snap = async label => {
  await page.waitForTimeout(2500);
  out.steps.push({ label, url: page.url().replace('https://erp.nexgenpilot.com', ''), ...(await vis()) });
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label, page.url());
};
const tryStep = async (label, fn) => { try { await fn(); await snap(label); } catch (e) { out.steps.push({ label, error: String(e).slice(0, 300) }); console.log('FAILED', label, String(e).slice(0, 150)); } };

try {
  await page.goto(`/suppliers/${ID}/overview`);
  await page.getByRole('tab', { name: 'Overview' }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(4000);
  await snap('overview (with sidebar menu)');
  await tryStep('products tab', async () => { await page.getByRole('tab', { name: 'Products' }).click(); await page.waitForTimeout(4000); });
  const PRODUCT = process.argv[4] ?? 'Hotel';
  await tryStep(`product ${PRODUCT}`, async () => { await page.getByRole('button', { name: PRODUCT, exact: true }).last().click(); await page.waitForTimeout(5000); });
  for (const sub of ['Contract', 'Allotment', 'Promotions', 'Rate check']) {
    await tryStep(`sub ${sub}`, async () => { await page.getByRole('tab', { name: sub, exact: true }).last().click(); await page.waitForTimeout(5000); });
    if (sub === 'Contract') {
      await tryStep('contract first row', async () => { await page.locator('main :visible').getByText(/20\d\d-\d\d|20\d\d/).first().click(); await page.waitForTimeout(5000); });
      for (const t of ['Rates', 'Policies', 'Supplements', 'Terms', 'Overview', 'Details']) {
        const tb = page.getByRole('tab', { name: new RegExp(`^${t}`) }).last();
        if (await tb.count()) await tryStep(`contract tab ${t}`, async () => { await tb.click(); await page.waitForTimeout(4000); });
      }
      await page.getByRole('tab', { name: 'Contract', exact: true }).last().click().catch(() => {});
      await page.waitForTimeout(3000);
    }
  }
  // the Contracts menu
  await page.goto('/contracts');
  await page.waitForTimeout(8000);
  await tryStep('contracts open Marina Bay', async () => { await page.getByText('Marina Bay Hotel 2026-27 (BB)').first().click(); await page.waitForTimeout(6000); });
} catch (e) { out.error = String(e).slice(0, 500); await snap('error').catch(() => {}); }
out.sent = sent;
out.contractRequests = gets;
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify(out, null, 2));
await browser.close();
