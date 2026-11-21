// Helper (not a test): READ-ONLY - date rules and the "problems to fix" list of the contract editor. Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract6';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').match(/"valid\w+":"[^"]+"|"sell\w+":"[^"]+"|"priority":-?\d+/g)?.join(' ')}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const btn = name => page.getByRole('button', { name, exact: true }).last();
const dates = () => page.getByPlaceholder('Choose a date').evaluateAll(els => els.slice(0, 4).map(e => e.value).join(' , '));
const state = async () => ({
  dates: await dates(),
  problems: await page.getByText(/problems? to fix/).last().innerText().catch(() => 'none'),
  red: await page.locator('main .Mui-error:visible').evaluateAll(els => [...new Set(els.map(e => (e.closest('.MuiFormControl-root')?.parentElement?.innerText || '').split('\n')[0]))]),
  pop: (await page.locator('[role=tooltip]:visible, .MuiPopover-paper:visible, [role=dialog]:visible, [role=alert]:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').slice(0, 600)),
  sent: sent.length,
});
const step = async (label, fn) => {
  try { await fn(); await page.waitForTimeout(1500); log.push({ label, ...(await state()) }); } catch (e) { log.push({ label, error: String(e).slice(0, 200) }); }
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/[^\w]+/g, '-')}.png` });
  console.log(JSON.stringify(log.at(-1)));
};
const setDate = async (i, v) => { const f = page.getByPlaceholder('Choose a date').nth(i); await f.click(); await page.keyboard.type(v, { delay: 20 }); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); };

await page.goto('/suppliers/18/products');
await page.getByRole('tab', { name: 'Products' }).first().waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
await page.waitForTimeout(4000);
await page.getByRole('tab', { name: 'Contract', exact: true }).last().click();
await page.waitForTimeout(3000);
await btn('Add contract').click();
await page.waitForTimeout(4000);
await page.getByPlaceholder('Enter a contract name').fill('QA Probe Contract');
await page.getByPlaceholder('Choose a base plan').click();
await page.getByRole('option', { name: 'Bed and breakfast' }).click();
await page.getByPlaceholder('Choose a currency').click();
await page.getByRole('option').first().click();

await step('valid to BEFORE valid from (10 Jan 2026) + save', async () => { await setDate(1, '10 Jan 2026'); await btn('Save').click(); });
await step('click problems', async () => { await page.getByText(/problems? to fix/).last().click(); });
await page.keyboard.press('Escape');
await step('valid to back to 15 Nov 2027; sell to AFTER valid to (01 Jan 2028) + save', async () => { await setDate(1, '15 Nov 2027'); await setDate(3, '01 Jan 2028'); await btn('Save').click(); });
await page.keyboard.press('Escape');
await step('sell to back; sell from AFTER sell to + save', async () => { await setDate(3, '15 Nov 2027'); await setDate(2, '01 Dec 2027'); await btn('Save').click(); });
await page.keyboard.press('Escape');
await step('dates OK; priority -5 + save', async () => { await setDate(2, '16 Nov 2026'); const p = page.locator('main input[type=number]:visible').first(); await p.fill('-5'); await p.press('Tab'); await btn('Save').click(); });
await page.keyboard.press('Escape');
await step('valid from in the past (01 Jan 2020) + save', async () => { const p = page.locator('main input[type=number]:visible').first(); await p.fill('1'); await setDate(0, '01 Jan 2020'); await btn('Save').click(); });
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify({ log, sent }, null, 2));
console.log('SENT:\n' + sent.join('\n'));
await browser.close();
