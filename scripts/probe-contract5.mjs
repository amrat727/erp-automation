// Helper (not a test): READ-ONLY - how to enter dates, add a season and type a price in the contract editor. Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-contract5';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push({ req: `${m} ${r.request().url()}`, body: (r.request().postData() || '').slice(0, 4000) }); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const dates = () => page.getByPlaceholder('Choose a date').evaluateAll(els => els.map(e => e.value).join(' , '));
const shot = async l => { await page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${l.replace(/[^\w]+/g, '-')}.png` }); };
const tryIt = async (label, fn) => { try { await fn(); await page.waitForTimeout(800); log.push(`${label}: ${await dates()}`); } catch (e) { log.push(`${label}: FAILED ${String(e).slice(0, 160)}`); } await shot(label); };
const btn = name => page.getByRole('button', { name, exact: true }).last();

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
log.push(`start: ${await dates()}`);

const vt = page.getByPlaceholder('Choose a date').nth(1);
await tryIt('A type + Enter', async () => { await vt.click(); await page.keyboard.type('01 Jan 2027', { delay: 30 }); await page.keyboard.press('Enter'); });
await page.keyboard.press('Escape');
await tryIt('B insertText + blur', async () => { await vt.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText('02 Feb 2027'); await page.locator('main').getByText('Contract details').click(); });
await page.keyboard.press('Escape');
await tryIt('C pressSequentially dd/mm/yyyy', async () => { await vt.click(); await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await vt.pressSequentially('03/03/2027', { delay: 40 }); await vt.press('Enter'); });
await page.keyboard.press('Escape');
await tryIt('D calendar day click', async () => { await page.getByRole('button', { name: 'Open calendar' }).nth(1).click(); await page.waitForTimeout(800); await page.getByRole('gridcell', { name: '20' }).or(page.locator('[role=dialog] button, [role=presentation] button').filter({ hasText: /^20$/ })).first().click(); });
await page.keyboard.press('Escape');
log.push('popup html: ' + (await page.locator('body > div[role=presentation], body > .MuiPopover-root, body > .MuiPopper-root').count()));

// valid-to before valid-from via calendar: open, go back 12 months
await tryIt('E calendar back to Jan 2026', async () => {
  await page.getByRole('button', { name: 'Open calendar' }).nth(1).click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 24; i++) {
    const head = await page.locator('body').innerText();
    if (/January\s+2026/.test(head)) break;
    await page.getByRole('button', { name: /previous/i }).last().click();
    await page.waitForTimeout(150);
  }
  await page.locator('button:visible').filter({ hasText: /^10$/ }).last().click();
});
await page.keyboard.press('Escape');
await tryIt('F save (valid to < valid from)', async () => { await btn('Save').click(); await page.waitForTimeout(3000); log.push('problems: ' + await page.getByText(/problems? to fix/).last().innerText().catch(() => 'none')); });

// season
await tryIt('G add season dialog', async () => { await btn('Add season').click(); await page.waitForTimeout(1000); });
await tryIt('H fill season + add', async () => {
  const d = page.getByRole('dialog').last();
  await d.getByPlaceholder('Enter a season name').fill('QA Season');
  await d.getByRole('button', { name: 'Add season' }).click();
  await page.waitForTimeout(1500);
});
const priceInputs = await page.locator('main input:visible').evaluateAll(els => els.map((e, i) => `${i}:${e.getAttribute('aria-label') || ''}|${e.placeholder}|${e.value}`).filter(s => !/Search/.test(s)));
log.push('inputs after season: ' + priceInputs.join(' ;; '));
await tryIt('I type a price', async () => {
  const p = page.locator('main input[aria-label*="Club"]:visible').first();
  await p.fill('450');
  await p.press('Tab');
});
await tryIt('J save', async () => { await btn('Save').click(); await page.waitForTimeout(4000); });
fs.writeFileSync(`${DIR}/probe.json`, JSON.stringify({ log, sent }, null, 2));
console.log(log.join('\n'));
console.log('SENT', sent.length);
for (const s of sent) console.log(s.req, s.body.slice(0, 1500));
await browser.close();
