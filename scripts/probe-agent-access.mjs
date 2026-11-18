// Helper (not a test): READ-ONLY - the Edit dialogs / sections on an agent's Access tab. Every save is blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-agent-access';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()} ${(r.request().postData() || '').slice(0, 600)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const clean = s => s.replace(/\s+/g, ' ').trim();
const dump = async label => {
  await page.waitForTimeout(1500);
  const dlg = (await page.getByRole('dialog').allInnerTexts()).map(s => clean(s).slice(0, 1500));
  const ins = await page.locator('main input:visible, [role=dialog] input:visible').evaluateAll(els => els.map(e => [e.getAttribute('aria-label') || '', e.type, e.placeholder, e.disabled ? 'DIS' : '', e.type === 'checkbox' ? String(e.checked) : (e.value || '').slice(0, 25)].filter(Boolean).join('|')).filter(s => !/Search|^text\|All$|^text\|8$/.test(s)));
  const text = clean(await page.locator('main').innerText()).replace(/^.*?On-behalf activity/, '').slice(0, 1800);
  log.push(`== ${label}` + (dlg.length ? `\n  DIALOG: ${dlg.join(' || ')}` : '') + `\n  TEXT: ${text}\n  INPUTS: ${ins.join(' ; ').slice(0, 1500)}`);
  await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${label.replace(/\W+/g, '-')}.png`, fullPage: true });
  console.log('step', n, label);
};
const open = async () => { await page.goto('/agents/2/access'); await page.waitForTimeout(5000); };
const editOf = async section => {
  const head = page.locator('main :visible').getByText(section, { exact: true }).first();
  await head.scrollIntoViewIfNeeded();
  const b = head.locator('xpath=ancestor::*[.//button[normalize-space()="Edit"]][1]').locator('button', { hasText: /^Edit$/ }).first();
  await b.click();
};
for (const s of ['Portal menus', 'Portal users', 'Portal login', 'Payments', 'Login on behalf', 'Cancel & change']) {
  await open();
  try { if (s === 'Portal menus' || s === 'Portal users') await page.locator('main :visible').getByText(s, { exact: true }).first().click(); await page.waitForTimeout(1000); await dump(`${s} expanded`); } catch {}
  try { await editOf(s); await dump(`${s} edit`); } catch (e) { log.push(`!! ${s}: ${String(e).split('\n')[0].slice(0, 120)}`); }
  await page.keyboard.press('Escape');
}
fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n') + '\n\nSENT:\n' + sent.join('\n'));
console.log(log.join('\n'));
await browser.close();
