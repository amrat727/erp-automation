// Helper (not a test): READ-ONLY dry run of Add agent + the edit actions on an agent's tabs. Every save is blocked and its body recorded.
// Run:  node scripts/probe-agent3.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-agent3';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ at: n, req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 2500) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
let n = 0;
const log = [];
const clean = s => s.replace(/\s+/g, ' ').trim();
const state = async () => ({
  url: page.url().replace('https://erp.nexgenpilot.com', ''),
  buttons: [...new Set((await page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '?') + (e.disabled ? '[DIS]' : '')))).map(clean))].filter(b => !/^(Share|Open|\?)$/.test(b)),
  inputs: await page.locator('main input:visible, main textarea:visible, [role=dialog] input:visible, [role=dialog] textarea:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText?.trim() || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', e.maxLength > 0 ? 'max' + e.maxLength : '', (e.value || '').slice(0, 30)].filter(Boolean).join('|'))),
  errors: (await page.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible').allInnerTexts()).map(clean).filter(Boolean),
  options: (await page.getByRole('option').allInnerTexts()).map(clean),
  dialogs: (await page.getByRole('dialog').allInnerTexts()).map(s => clean(s).slice(0, 1200)),
});
const step = async (label, fn) => {
  try { await fn(); await page.waitForTimeout(2000); } catch (e) { log.push(`!! ${label}: FAILED ${String(e).slice(0, 180)}`); }
  const s = await state();
  log.push(`== ${label}\n${JSON.stringify(s, null, 1).slice(0, 4000)}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label);
};
const btn = name => page.getByRole('button', { name, exact: true }).last();

// ---------- Add agent: empty, then filled ----------
await page.goto('/agents/new');
await page.getByRole('heading', { name: 'Add agent' }).waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await step('add empty create', () => btn('Create agent').click());
await step('exchange type options', async () => { await page.getByPlaceholder(/exchange/i).first().click(); });
await page.keyboard.press('Escape');
await step('currency options', async () => { await page.getByPlaceholder(/currency/i).first().click(); });
await page.keyboard.press('Escape');
await step('market options', async () => { await page.getByPlaceholder(/market/i).first().click(); });
await page.keyboard.press('Escape');
await step('account manager options', async () => { await page.getByPlaceholder(/manager/i).first().click(); });
await page.keyboard.press('Escape');
await step('fill minimum + create', async () => {
  await page.locator('main input[placeholder="Agent name"]').fill('QA Probe Agent');
  await page.locator('main input[placeholder="agency@example.com"]').fill('qa.probe.agent@example.com');
  await page.locator('main input[placeholder="Country"]').first().click();
  await page.keyboard.type('United Arab', { delay: 30 });
  await page.waitForTimeout(1200);
  await page.getByRole('option').first().click();
  for (const ph of [/exchange/i, /currency/i]) {
    const f = page.getByPlaceholder(ph).first();
    if (await f.count()) { await f.click(); await page.waitForTimeout(800); if (await page.getByRole('option').count()) await page.getByRole('option').first().click(); }
  }
  await btn('Create agent').click();
});
await step('allow credit yes', async () => { await page.getByText('Allow credit').first().locator('xpath=ancestor::div[2]').getByRole('button', { name: 'Yes' }).click(); });
await step('portal access yes', async () => { await page.getByText('Portal access').first().locator('xpath=ancestor::div[2]').getByRole('button', { name: 'Yes' }).click(); });
await step('create again', () => btn('Create agent').click());

// ---------- existing agent: edit actions per tab ----------
await page.goto('/agents');
await page.getByRole('heading', { name: 'Agents' }).first().waitFor({ timeout: 90_000 });
await page.waitForTimeout(3000);
await page.locator('main tbody tr:visible').filter({ hasText: 'AG-00002' }).locator('td').first().click();
await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(3000);
const base = page.url().replace(/\/overview.*/, '');
log.push('AGENT URL ' + base);
await step('overview edit', () => btn('Edit').click());
await step('overview edit clear name + save', async () => { await page.locator('main input[placeholder="Agent name"]').last().fill(''); await btn('Save').click(); });
await btn('Cancel').click().catch(() => {});
for (const t of ['addresses', 'financials', 'access', 'onbehalf']) {
  await step(`tab ${t}`, async () => { await page.goto(`${base}/${t}`); await page.waitForTimeout(4000); });
}
// financial actions
await page.goto(`${base}/financials`); await page.waitForTimeout(4000);
for (const b of ['Add currency', 'Request credit', 'Add top-up', 'Top up', 'Adjust', 'Add points']) {
  const l = page.locator('main button:visible', { hasText: new RegExp(`^${b}`) }).first();
  if (await l.count()) { await step(`financials ${b}`, () => l.click()); await page.keyboard.press('Escape'); }
}
// access actions
await page.goto(`${base}/access`); await page.waitForTimeout(4000);
for (const b of ['Add user', 'Add portal user', 'Invite user', 'Edit']) {
  const l = page.locator('main button:visible', { hasText: new RegExp(`^${b}`) }).first();
  if (await l.count()) { await step(`access ${b}`, () => l.click()); await page.keyboard.press('Escape'); }
}
fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n') + '\n\nSENT:\n' + sent.map(s => `#${s.at} ${s.req}\n${s.body}`).join('\n\n'));
console.log('SENT:\n' + sent.map(s => `#${s.at} ${s.req}\n${s.body}`).join('\n\n'));
await browser.close();
