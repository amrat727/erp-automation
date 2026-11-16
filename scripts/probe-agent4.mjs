// Helper (not a test): READ-ONLY - every remaining agent button / dialog with empty and wrong values. Saves blocked + recorded.
// Run:  node scripts/probe-agent4.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-agent4';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
let n = 0;
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ at: n, req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 1500) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
const clean = s => s.replace(/\s+/g, ' ').trim();
const step = async (label, fn) => {
  const before = sent.length;
  try { await fn(); await page.waitForTimeout(1800); } catch (e) { log.push(`!! ${label}: ${String(e).split('\n')[0].slice(0, 160)}`); }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);
  const safe = async p => { try { return await p; } catch { return []; } };
  const dlg = (await safe(page.getByRole('dialog').allInnerTexts())).map(s => clean(s).slice(0, 900));
  const errs = (await safe(page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts())).map(clean).filter(s => s && s !== '​');
  const opts = (await safe(page.getByRole('option').allInnerTexts())).map(clean);
  const menu = (await safe(page.getByRole('menuitem').allInnerTexts())).map(clean);
  const inputs = await safe(page.locator('main input:visible, [role=dialog] input:visible, [role=dialog] textarea:visible').evaluateAll(els => els.slice(5).map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', (e.value || '').slice(0, 25)].filter(Boolean).join('|'))));
  log.push(`== ${label}  [${page.url().replace('https://erp.nexgenpilot.com', '')}]` +
    (dlg.length ? `\n  dialog: ${dlg.join(' || ')}` : '') + (errs.length ? `\n  errors: ${errs.join(' ; ')}` : '') +
    (opts.length ? `\n  options: ${opts.join(' ; ')}` : '') + (menu.length ? `\n  menu: ${menu.join(' ; ')}` : '') +
    `\n  inputs: ${inputs.join(' ; ').slice(0, 900)}` + `\n  SENT: ${sent.slice(before).map(s => s.req + ' ' + s.body.slice(0, 400)).join(' || ') || 'none'}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
  console.log('step', n, label);
};
const btn = (name, exact = true) => page.getByRole('button', { name, exact }).last();
const dlg = () => page.getByRole('dialog').last();
const esc = () => page.keyboard.press('Escape');
const AG = '/agents/2';     // Gulf Horizons Travel LLC (AG-00002)
const go = async p => { for (let i = 0; i < 3; i++) { try { await page.goto(p); break; } catch { await page.waitForTimeout(1500); } } await page.waitForTimeout(4500); };

// ---------- Add agent: switches and extra fields ----------
await go('/agents/new');
await step('add: allow credit switch on', () => page.getByRole('checkbox', { name: 'Allow credit' }).check());
await step('add: portal access switch on', () => page.getByRole('checkbox', { name: 'Portal access' }).check());
await step('add: B2C + Concierge + Desk', async () => { await btn('B2C').click(); await btn('Concierge').click(); });
await step('add: Desk', () => btn('Desk').click());
await step('add: payment term options', () => page.getByRole('combobox', { name: 'Payment term' }).or(page.locator('main input[value="Days After Invoice"]')).first().click());
await esc();
await step('add: fill + negative credit + create', async () => {
  await btn('General').click(); await btn('B2B').click();
  await page.locator('main input[placeholder="Agent name"]').fill('QA Probe Agent');
  await page.locator('main input[placeholder="agency@example.com"]').fill('qa.probe@example.com');
  await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
  await page.locator('main input[placeholder="Country"]').first().click(); await page.keyboard.type('India', { delay: 30 }); await page.waitForTimeout(1200); await page.getByRole('option', { name: 'India', exact: true }).click();
  await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'US Dollar' }).click();
  const limit = page.locator('main input[type=number]:visible, main input[placeholder="0"]:visible').first();
  await limit.fill('-500');
  await btn('Create agent').click();
});
await step('add: state options for India', async () => { await page.locator('main input[placeholder="State"]').first().click(); });
await esc();
await step('add: duplicate email of AG-00002 + create', async () => { await page.locator('main input[placeholder="agency@example.com"]').fill('bookings@gulfhorizons-demo.test'); await btn('Create agent').click(); });

// ---------- detail: inline edit on Overview ----------
await go(`${AG}/overview`);
await step('overview: Edit (inline)', () => btn('Edit', true).click());
await step('overview: inline clear name + Save', async () => { await page.getByRole('textbox', { name: 'Agent name' }).last().fill(''); await btn('Save').click(); });
await step('overview: inline bad email + Save', async () => { await page.getByRole('textbox', { name: 'Agent name' }).last().fill('Gulf Horizons Travel LLC'); await page.getByRole('textbox', { name: 'Email' }).last().fill('abc'); await btn('Save').click(); });
await step('overview: status options', async () => { await page.getByRole('combobox', { name: 'Status' }).or(page.locator('main input[value="Approved"]')).first().click(); });
await esc();
await step('overview: inline Cancel', () => btn('Cancel').click());
await step('overview: G avatar button', () => btn('G').click());
await esc();
// full edit page
await step('edit page: Edit agent', async () => { await go(`${AG}/overview`); await btn('Edit agent').click(); await page.waitForTimeout(3000); });
await step('edit page: clear name + Save changes', async () => { await page.locator('main input[placeholder="Agent name"]').last().fill(''); await btn('Save changes').click(); });
await step('edit page: Cancel', () => btn('Cancel').click());

// ---------- Addresses ----------
await go(`${AG}/addresses`);
await step('addresses: Edit', () => page.locator('main button:visible', { hasText: /^Edit$/ }).first().click());
await step('addresses: bad email/phone + Save', async () => {
  await page.locator('main input[placeholder="Email"]:visible').first().fill('abc');
  await page.locator('main input[placeholder="Phone"]:visible').first().fill('abc!!');
  await btn('Save').click();
});
await step('addresses: Cancel', () => btn('Cancel').click());

// ---------- Financials ----------
await go(`${AG}/financials`);
await step('fin: Add currency empty Add', async () => { await btn('Add currency').click(); await dlg().getByRole('button', { name: 'Add' }).click(); });
await step('fin: Add currency options', () => dlg().getByPlaceholder('Select currency').click());
await esc(); await esc();
await step('fin: More for AED', () => btn('More for AED').click());
await esc();
await step('fin: Currency / Account toggle', () => btn('Account').click());
await step('fin: Add top-up empty Save', async () => { await btn('Add top-up').click(); await dlg().getByRole('button', { name: 'Save' }).click(); });
await step('fin: top-up payment modes', () => dlg().getByRole('combobox', { name: 'Payment mode' }).or(dlg().locator('input[value="Bank transfer"]')).first().click());
await esc();
await step('fin: top-up amount -100 Save', async () => { await dlg().locator('input[type=number]').fill('-100'); await dlg().getByRole('button', { name: 'Save' }).click(); });
await step('fin: top-up amount 0 Save', async () => { await dlg().locator('input[type=number]').fill('0'); await dlg().getByRole('button', { name: 'Save' }).click(); });
await esc();
await step('fin: ledger More', () => btn('More').click());
await esc();
await step('fin: All requests', () => btn('All requests').click());
await go(`${AG}/financials`);
await step('fin: Adjust empty Save', async () => { await btn('Adjust').click(); await dlg().getByRole('button', { name: 'Save' }).click(); });
await step('fin: Adjust take off 999999 Save', async () => { await dlg().getByText('Take points off (−)').click(); await dlg().locator('input[type=number]').fill('999999'); await dlg().locator('textarea').first().fill('QA probe'); await dlg().getByRole('button', { name: 'Save' }).click(); });
await esc();

// ---------- Access ----------
await go(`${AG}/access`);
for (const b of ['Portal login', 'Payments', 'Credit line', 'Company settings']) await step(`access: toggle ${b}`, () => btn(b).click());
await go(`${AG}/access`);
await step('access: Login on behalf', () => btn('Login on behalf').click());
await esc();
await go(`${AG}/access`);
await step('access: Cancel & change', () => btn('Cancel & change').click());
await esc();
await go(`${AG}/access`);
await step('access: products/menus Edit', () => page.locator('main button:visible', { hasText: /^Edit$/ }).first().click());

// ---------- On-behalf + Credit Requests ----------
await go(`${AG}/onbehalf`);
await step('onbehalf: Done by this agent', () => btn('Done by this agent').click());
await step('onbehalf: acting agent options', () => page.getByPlaceholder('Any acting agent').click());
await esc();
await go('/agents/credit-requests');
await step('credit requests: All tab', () => page.getByRole('tab', { name: 'All' }).click());
await step('credit requests: first row', () => page.locator('main tbody tr:visible').first().click());

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
