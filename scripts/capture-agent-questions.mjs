// Helper (not a test): READ-ONLY screenshots for the Agent-module questions (and BUG-69 evidence).
// Every POST/PUT/DELETE/PATCH is blocked. Output: reports/Agent-Questions/screenshots/A-NN-*.png
// Run:  node scripts/capture-agent-questions.mjs [A-01 A-02 ...]
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = 'reports/Agent-Questions/screenshots';
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync('screenshots/bugs', { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
let sentCount = 0;
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sentCount++; return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const ONLY = process.argv.slice(2);
const red = async loc => { try { await loc.first().evaluate(el => { el.style.outline = '4px solid red'; el.style.outlineOffset = '2px'; }, null, { timeout: 8000 }); } catch {} };
const shot = async (id, label, fn, ...marks) => {
  if (ONLY.length && !ONLY.includes(id)) return;
  try {
    await fn();
    await page.waitForTimeout(1500);
    for (const m of marks) await red(typeof m === 'function' ? m() : m);
    await page.waitForTimeout(300);
    const path = id.startsWith('BUG') ? `screenshots/bugs/${id}-${label}.png` : `${DIR}/${id}-${label}.png`;
    await page.screenshot({ path });
    console.log('ok', id, label);
  } catch (e) { console.log('FAILED', id, label, String(e).split('\n')[0].slice(0, 160)); }
  await page.keyboard.press('Escape').catch(() => {});
};
const go = async p => { for (let i = 0; i < 3; i++) { try { await page.goto(p); break; } catch { await page.waitForTimeout(1500); } } await page.waitForTimeout(4500); };
const vbtn = n => page.locator('main button:visible', { hasText: new RegExp(`^${n}$`) }).first();
const field = ph => page.locator(`main input[placeholder="${ph}"]`).first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]');
const AG = '/agents/2';

await shot('A-01', 'agent-status', async () => { await go(`${AG}/overview`); await vbtn('Edit').click(); await page.locator('main input[value="Approved"]').first().click(); }, () => page.getByRole('listbox'));
await shot('A-02', 'agent-approve', async () => { await go('/agents/new'); }, () => page.getByRole('button', { name: 'Approved', exact: true }).locator('xpath=..'));
await shot('A-03', 'agent-type-segment', async () => { await go('/agents/new'); }, () => page.getByRole('button', { name: 'B2C', exact: true }).locator('xpath=..'), () => page.getByRole('button', { name: 'Desk', exact: true }).locator('xpath=..'));
await shot('A-04', 'agent-exchange-type', async () => { await go('/agents/new'); await page.locator('main input[placeholder="Exchange type"]').click(); }, () => page.getByRole('listbox'));
await shot('A-05', 'agent-credit-limit', async () => { await go('/agents/new'); await page.locator('main input[aria-label="Allow credit"]').click(); }, () => page.locator('main input[aria-label="Credit limit"]').locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await shot('A-06', 'agent-payment-terms', async () => { await go('/agents/new'); await page.locator('main input[value="Days After Invoice"]').click(); }, () => page.getByRole('listbox'));
await shot('A-07', 'agent-portal-login', async () => { await go('/agents/new'); await page.locator('main input[aria-label="Portal access"]').click(); }, () => page.locator('main input[type=password]').locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await shot('A-08', 'agent-markets', async () => { await go('/agents/new'); await page.getByPlaceholder('No markets').click(); }, () => page.getByRole('listbox'));
await shot('A-09', 'agent-currencies', async () => { await go(`${AG}/financials`); }, () => page.locator('main table:visible').last());
await shot('A-10', 'agent-topup', async () => { await go(`${AG}/financials`); await vbtn('Add top-up').click(); }, () => page.getByRole('dialog').last());
await shot('A-11', 'agent-ledger-actions', async () => { await go(`${AG}/financials`); await vbtn('More').click(); }, () => page.getByRole('menu'));
await shot('A-12', 'agent-ledger-adjustment', async () => { await go(`${AG}/financials`); await vbtn('More').click(); await page.getByRole('menuitem', { name: 'Ledger adjustment' }).click(); }, () => page.getByRole('dialog').last());
await shot('A-13', 'agent-loyalty', async () => { await go(`${AG}/financials`); }, () => page.getByText('Loyalty points').first().locator('xpath=ancestor::div[3]'));
await shot('A-14', 'agent-credit-requests', async () => { await go('/agents/credit-requests'); }, () => page.locator('main').getByText(/Only my agents/).first());
await shot('A-15', 'agent-products-access', async () => { await go(`${AG}/access`); }, () => page.getByText(/\d+ of \d+ on/).first().locator('xpath=ancestor::div[3]'));
await shot('A-16', 'agent-portal-access', async () => { await go(`${AG}/access`); }, () => page.getByText('Portal access').first().locator('xpath=ancestor::div[3]'));
await shot('A-17', 'agent-login-on-behalf', async () => { await go(`${AG}/access`); }, () => vbtn('Login on behalf'), () => vbtn('Cancel & change'));
await shot('A-18', 'agent-onbehalf', async () => { await go(`${AG}/onbehalf`); }, () => vbtn('Done for this agent').locator('xpath=..'));
await shot('A-19', 'agent-plan-tier', async () => { await go(`${AG}/overview`); }, () => page.getByText(/Plan & tier/).first().locator('xpath=ancestor::div[3]'));
await shot('A-20', 'agent-addresses', async () => { await go(`${AG}/addresses`); }, () => page.getByText('Primary address').first().locator('xpath=ancestor::div[3]'));
await shot('A-21', 'agent-list', async () => { await go('/agents'); }, () => page.locator('main thead').first());
await shot('A-22', 'agent-account-manager', async () => { await go(`${AG}/overview`); }, () => page.locator('main input[aria-label="Account manager"]').first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'), () => page.locator('main input[aria-label="Designation"]').first().locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await shot('BUG-69', 'agent-negative-credit-limit-sent', async () => {
  await go('/agents/new');
  await page.locator('main input[aria-label="Allow credit"]').click();
  await page.locator('main input[placeholder="Agent name"]').fill('QA Auto Agent credit check');
  await page.locator('main input[placeholder="agency@example.com"]').fill('qa.auto.credit@example.com');
  await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
  await page.locator('main input[placeholder="Country"]').first().click(); await page.keyboard.type('United Arab', { delay: 30 }); await page.waitForTimeout(1200); await page.getByRole('option').first().click();
  await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'US Dollar' }).click();
  await page.locator('main input[aria-label="Credit limit"]').fill('-500');
  await page.getByRole('button', { name: 'Create agent' }).click();
  await page.waitForTimeout(2500);
  console.log('requests sent (blocked): ' + sentCount);
}, () => page.locator('main input[aria-label="Credit limit"]').locator('xpath=ancestor::div[contains(@class,"MuiFormControl-root")][1]'));
await browser.close();
