// Helper (not a test): READ-ONLY - agent add-form switches, top-up, ledger actions, remove currency, access buttons. Saves blocked + recorded.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-agent5';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 700)}`); return r.abort(); }
  return r.continue();
});
ctx.on('page', p => sent.push('NEW TAB OPENED: ' + p.url()));
const page = await ctx.newPage();
const log = [];
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const safe = async p => { try { return await p; } catch { return []; } };
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(1800); } catch (e) { log.push(`!! ${label}: ${String(e).split('\n')[0].slice(0, 150)}`); }
  const dlg = (await safe(page.getByRole('dialog').allInnerTexts())).map(s => clean(s).slice(0, 900));
  const errs = [...new Set((await safe(page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts())).map(clean).filter(s => s && s !== '​'))];
  const opts = (await safe(page.getByRole('option').allInnerTexts())).map(clean);
  const menu = (await safe(page.getByRole('menuitem').allInnerTexts())).map(clean);
  const ins = await safe(page.locator('main input:visible, [role=dialog] input:visible, [role=dialog] textarea:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', e.min ? 'min' + e.min : '', (e.value || '').slice(0, 25)].filter(Boolean).join('|')).filter(s => !/Search|^text\|All$|^text\|8$/.test(s))));
  log.push(`== ${label}  [${page.url().replace('https://erp.nexgenpilot.com', '')}]` + (dlg.length ? `\n  DIALOG: ${dlg.join(' || ')}` : '') + (errs.length ? `\n  ERRORS: ${errs.join(' ; ')}` : '') +
    (opts.length ? `\n  OPTIONS: ${opts.join(' ; ')}` : '') + (menu.length ? `\n  MENU: ${menu.join(' ; ')}` : '') + `\n  INPUTS: ${ins.join(' ; ').slice(0, 1000)}` + `\n  SENT: ${sent.slice(before).join(' || ') || 'none'}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  console.log('step', n, label);
};
const go = async p => { for (let i = 0; i < 3; i++) { try { await page.goto(p); break; } catch { await page.waitForTimeout(1500); } } await page.waitForTimeout(4500); };
const dlg = () => page.getByRole('dialog').last();
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(400); };
const AG = '/agents/2';

// add form switches
await go('/agents/new');
await step('add: Allow credit on', () => page.locator('main input[aria-label="Allow credit"]').click());
await step('add: Portal access on', () => page.locator('main input[aria-label="Portal access"]').click());
await step('add: type B2C', () => page.getByRole('button', { name: 'B2C', exact: true }).click());
await step('add: Concierge', () => page.getByRole('button', { name: 'Concierge', exact: true }).click());
await step('add: Desk', () => page.getByRole('button', { name: 'Desk', exact: true }).click());
await step('add: country India -> state list', async () => { await page.getByRole('button', { name: 'General', exact: true }).click(); await page.locator('main input[placeholder="Country"]').first().click(); await page.keyboard.type('India', { delay: 40 }); await page.waitForTimeout(1500); await page.getByRole('option', { name: 'India', exact: true }).click(); await page.locator('main input[placeholder="State"]').first().click(); });
await esc();
await step('add: full form with credit limit -500 + login', async () => {
  await page.locator('main input[placeholder="Agent name"]').fill('QA Probe Agent');
  await page.locator('main input[placeholder="agency@example.com"]').fill('qa.probe.agent@example.com');
  await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
  await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'US Dollar' }).click();
  const nums = page.locator('main input[type=number]:visible, main input[placeholder="0"]:visible');
  if (await nums.count()) await nums.first().fill('-500');
  await page.getByRole('button', { name: 'Create agent' }).click();
});

// financials dialogs
await go(`${AG}/financials`);
await step('fin: Add top-up open', () => page.getByRole('button', { name: 'Add top-up' }).click());
await step('fin: top-up empty Save', () => dlg().getByRole('button', { name: 'Save' }).click());
await step('fin: top-up payment modes', () => dlg().locator('input[value="Bank transfer"]').click());
await esc();
await step('fin: top-up -100 Save', async () => { await dlg().locator('input[type=number]').fill('-100'); await dlg().getByRole('button', { name: 'Save' }).click(); });
await step('fin: top-up 0 Save', async () => { await dlg().locator('input[type=number]').fill('0'); await dlg().getByRole('button', { name: 'Save' }).click(); });
await esc(); await esc();
for (const item of ['Record credit settlement', 'Ledger adjustment', 'Grant promotional credit', 'Record supplier credit']) {
  await go(`${AG}/financials`);
  await step(`fin: More > ${item}`, async () => { await page.getByRole('button', { name: 'More', exact: true }).click(); await page.getByRole('menuitem', { name: item }).click(); });
  await step(`fin: ${item} empty Save`, () => dlg().getByRole('button', { name: /^(Save|Record|Grant|Add|Submit)/ }).last().click());
  await esc();
}
await go(`${AG}/financials`);
await step('fin: More for AED > Remove currency', async () => { await page.getByRole('button', { name: 'More for AED' }).click(); await page.getByRole('menuitem', { name: 'Remove currency' }).click(); });
await esc();
await step('fin: Add currency USD + Add', async () => { await page.getByRole('button', { name: 'Add currency' }).click(); await dlg().getByPlaceholder('Select currency').click(); await page.getByRole('option', { name: /US Dollar/ }).click(); await dlg().getByRole('button', { name: 'Add' }).click(); });
await esc();
// access
await go(`${AG}/access`);
await step('access: page', async () => {});
await step('access: Edit (products/menus)', () => page.locator('main button:visible', { hasText: /^Edit$/ }).first().click());
await go(`${AG}/access`);
await step('access: Login on behalf', () => page.getByRole('button', { name: 'Login on behalf' }).click());
await esc();
await go(`${AG}/access`);
await step('access: Cancel & change', () => page.getByRole('button', { name: 'Cancel & change' }).click());
await esc();
// on-behalf + credit requests
await go(`${AG}/onbehalf`);
await step('onbehalf: page', async () => {});
await go('/agents/credit-requests');
await step('credit requests: page', async () => {});
await step('credit requests: All', () => page.getByRole('tab', { name: 'All' }).click());

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
