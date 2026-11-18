// Helper (not a test): READ-ONLY - what can still be changed on a BLOCKED supplier, and how a currency is removed in Financials.
// Every save is blocked and recorded (a recorded request = the screen let the change through).
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-blocked';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
let n = 0;
const log = [];
const shot = async l => page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${l.replace(/[^\w]+/g, '-')}.png` });
const btns = async () => (await page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '?') + (e.disabled ? '[DISABLED]' : '')))).filter(b => !/^(Share|Open|Open calendar|\?)$/.test(b) && !/Overview|Contacts|Products|Financials|Content|Add supplier|Audit|Columns|Go to/.test(b));
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(2500); } catch (e) { log.push(`${label}: FAILED ${String(e).slice(0, 150)}`); }
  log.push(`== ${label}\n  url ${page.url().replace('https://erp.nexgenpilot.com', '')}\n  buttons: ${(await btns()).join(' | ')}\n  dialogs: ${(await page.getByRole('dialog').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 300)).join(' || ')}\n  NEW REQUESTS: ${sent.slice(before).join(' ; ') || 'none'}`);
  await shot(label);
};

// find a blocked QA supplier
await page.goto('/suppliers');
await page.getByRole('heading', { name: /^Suppliers/ }).first().waitFor({ timeout: 90_000 });
await page.waitForTimeout(4000);
await page.getByRole('columnheader', { name: /^Name/ }).getByRole('textbox').fill('QA Auto Supplier');
await page.waitForTimeout(3000);
const row = page.locator('main tbody tr:visible', { hasText: 'Blocked' }).first();
log.push('blocked row: ' + (await row.innerText()).replace(/\s+/g, ' '));
await row.locator('td').first().click();
await page.getByRole('tab', { name: 'Overview' }).first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(3000);
const base = page.url().replace(/\/overview.*/, '');
log.push('blocked supplier url: ' + base);

await step('blocked overview', async () => {});
await step('blocked edit + rename + save', async () => {
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.waitForTimeout(1000);
  const nm = page.locator('main input[placeholder="Supplier name"]:visible, main input[placeholder*="name" i]:visible').first();
  await nm.fill((await nm.inputValue()) + ' x');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();
});
await step('blocked contacts add contact', async () => {
  await page.goto(base + '/contacts'); await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /Add contact$/ }).last().click(); await page.waitForTimeout(1000);
  const d = page.getByRole('dialog').last();
  await d.getByPlaceholder('Full name').fill('QA Probe Contact');
  await d.getByPlaceholder('Reservations, Sales, Accounts…').click(); await page.waitForTimeout(500);
  await page.getByRole('option').first().click();
  await d.getByRole('button', { name: 'Save' }).click();
});
await page.keyboard.press('Escape');
await step('blocked financials', async () => { await page.goto(base + '/financials'); await page.waitForTimeout(4000); });
await step('blocked financials add currency', async () => {
  await page.getByRole('button', { name: /Add currency$/ }).last().click(); await page.waitForTimeout(1000);
  const d = page.getByRole('dialog').last();
  await d.getByPlaceholder('Select a currency').fill('USD');
  await page.getByRole('option', { name: /USD/ }).first().click();
  await d.getByRole('button', { name: 'Save' }).click();
});
await page.keyboard.press('Escape');
await step('blocked products', async () => { await page.goto(base + '/products'); await page.waitForTimeout(4000); });
await step('blocked product hotel contract tab', async () => {
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click(); await page.waitForTimeout(3500);
  await page.getByRole('tab', { name: 'Contract', exact: true }).last().click(); await page.waitForTimeout(3000);
});
await step('blocked add contract + save', async () => {
  await page.getByRole('button', { name: 'Add contract' }).last().click(); await page.waitForTimeout(3000);
  await page.getByPlaceholder('Enter a contract name').fill('QA Probe Contract');
  await page.getByPlaceholder('Choose a base plan').click(); await page.waitForTimeout(500);
  await page.getByRole('option', { name: 'Bed and breakfast' }).click();
  await page.getByPlaceholder(/Choose a currency/).click(); await page.waitForTimeout(500);
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();
});

// ---- currency remove action on Testing season 3 (id 18)
await step('ts3 financials', async () => { await page.goto('/suppliers/18/financials'); await page.waitForTimeout(5000); });
const cur = page.locator('main table:visible').last().locator('tbody tr', { hasText: 'AED' }).first();
log.push('AED row buttons: ' + (await cur.locator('button').evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.innerText.trim()))).join(' | '));
await step('ts3 AED row last button', async () => { await cur.locator('button').last().click(); });
log.push('menu items: ' + (await page.getByRole('menuitem').allInnerTexts()).join(' | '));
await step('ts3 remove currency (if offered)', async () => {
  const rm = page.getByRole('menuitem', { name: /Remove|Delete/ }).or(page.getByRole('button', { name: /Remove|Delete/ })).first();
  await rm.click({ timeout: 8000 });
});

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
