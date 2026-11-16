// Helper (not a test): READ-ONLY - product edit mode, active switch, dropdown options and age-policy behaviour. Saves blocked.
import { chromium } from '@playwright/test';
import fs from 'fs';

const DIR = process.argv[2] ?? 'probe-products3';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}\n   ${(r.request().postData() || '').slice(0, 2500)}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
const log = [];
let n = 0;
const shot = async l => page.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${l.replace(/\W+/g, '-')}.png`, fullPage: true }).catch(() => {});
const note = async (l, fn) => { try { const r = await fn(); log.push(`== ${l}: ${typeof r === 'string' ? r : JSON.stringify(r)}`); } catch (e) { log.push(`!! ${l}: ${String(e).split('\n')[0].slice(0, 150)}`); } await shot(l); };
const opts = async () => { await page.waitForTimeout(800); const o = await page.getByRole('option').allInnerTexts(); await page.keyboard.press('Escape'); return o.join(' ; '); };
const btns = () => page.locator('main button:visible').evaluateAll(els => els.map(e => (e.innerText.trim() || e.getAttribute('aria-label') || '?') + (e.disabled ? '[DIS]' : '')).filter(b => !/^(Share|Open|\?)$/.test(b)).slice(-40));
const toProduct = async p => {
  for (let i = 0; i < 3; i++) { try { await page.goto('/suppliers/18/products'); break; } catch { await page.waitForTimeout(1500); } }
  await page.getByText('Choose a product type').waitFor({ timeout: 90_000 }); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: p, exact: true }).last().click(); await page.waitForTimeout(4000);
};
const val = ph => page.getByPlaceholder(ph, { exact: true });

// ---- hotel room: view / edit
await toProduct('Hotel');
await page.getByRole('button', { name: 'Club', exact: true }).last().click(); await page.waitForTimeout(3500);
await note('club buttons (view mode)', btns);
await note('club switches/checkboxes', () => page.locator('main input[type=checkbox]:visible').evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || e.closest('label')?.innerText || e.name || '?') + '=' + e.checked + (e.disabled ? '[DIS]' : ''))));
await note('club click Edit', async () => { await page.locator('main button:visible', { hasText: /^Edit/ }).last().click(); await page.waitForTimeout(2000); return btns(); });
await note('club edit: clear room name + Save', async () => { await page.getByPlaceholder('Room Name').fill(''); await page.locator('main button:visible', { hasText: /^(Save|Save changes|Update)/ }).last().click(); await page.waitForTimeout(2000); return (await page.locator('[role=alert]:visible, .Mui-error:visible').allInnerTexts()).join(' | '); });
await note('club edit: Cancel', async () => { await page.locator('main button:visible', { hasText: /^Cancel$/ }).last().click(); await page.waitForTimeout(1500); return (await page.getByRole('dialog').allInnerTexts()).join(' | '); });

// ---- hotel add room: dropdowns + age policy
await toProduct('Hotel');
await page.getByRole('button', { name: 'Add room', exact: true }).last().click(); await page.waitForTimeout(3000);
await note('room View options', async () => { await val('Select').nth(0).click(); return opts(); });
await note('room Charged per options', async () => { await page.locator('main input[value="Room"]').first().click(); return opts(); });
await note('room Sell as options', async () => { await page.locator('main input[value="Standalone and in packages"]').first().click(); return opts(); });
await note('room "Select room" (interconnecting) options', async () => { await page.getByPlaceholder('Select room').click().catch(() => {}); return opts(); });
await note('age: infant to = 5 -> child from', async () => { const f = page.getByRole('spinbutton', { name: 'Infant to' }); await f.fill('5'); await f.press('Tab'); await page.waitForTimeout(500); return { childFrom: await page.getByRole('spinbutton', { name: 'Child from' }).inputValue() }; });
await note('age: child to = 2 (below child from)', async () => { const f = page.getByRole('spinbutton', { name: 'Child to' }); await f.fill('2'); await f.press('Tab'); await page.waitForTimeout(500); return { childTo: await f.inputValue(), adultFrom: await page.getByRole('spinbutton', { name: 'Adult from' }).inputValue(), errors: await page.locator('.Mui-error:visible').allInnerTexts() }; });
await note('occupancy: Add room row', async () => { await page.locator('main button:visible', { hasText: /^Add room$/ }).last().click(); await page.waitForTimeout(800); return page.locator('main tbody tr:visible').count(); });
await note('fill name+view, adults 0 total 0, Create', async () => {
  await page.getByPlaceholder('Room Name').fill('QA Probe Room');
  await val('Select').nth(0).click(); await page.waitForTimeout(600); await page.getByRole('option').first().click();
  const a = page.locator('main input[name="adults"]').first(); await a.fill('0'); await a.press('Tab');
  await page.locator('main button:visible', { hasText: /^Create product$/ }).click(); await page.waitForTimeout(3000);
  return (await page.locator('[role=alert]:visible, .Mui-error:visible').allInnerTexts()).join(' | ');
});

// ---- excursion: dropdowns + view/edit
await toProduct('Excursion');
await page.getByRole('button', { name: 'Add excursion', exact: true }).last().click(); await page.waitForTimeout(3000);
await note('excursion Service on options', async () => { await page.locator('main input[value="Service"]').first().click(); return opts(); });
await note('excursion Service by options', async () => { await page.locator('main input[value="Pax"]').first().click(); return opts(); });
await note('excursion City options (type Abu)', async () => { const c = page.getByPlaceholder('Select').first(); await c.click(); await page.keyboard.type('Abu', { delay: 40 }); return opts(); });
await note('excursion Sub services switch on', async () => { await page.locator('main input[type=checkbox]:visible').filter({ hasNot: page.locator('[aria-label]') }).first().check().catch(() => {}); await page.waitForTimeout(800); return btns(); });
await note('excursion max capacity 0 + name + Create', async () => {
  await page.getByPlaceholder('Enter a product name').fill('QA Probe Excursion');
  const cap = page.locator('main input[type=number][placeholder="1"]').first(); await cap.fill('0'); await cap.press('Tab');
  await page.locator('main button:visible', { hasText: /^Create product$/ }).click(); await page.waitForTimeout(3000);
  return (await page.locator('[role=alert]:visible, .Mui-error:visible').allInnerTexts()).join(' | ');
});
await note('excursion height min 200 max 100 + Create', async () => {
  const cap = page.locator('main input[type=number][placeholder="1"]').first(); await cap.fill('20');
  await page.getByPlaceholder('Min').fill('200'); await page.getByPlaceholder('Max').fill('100');
  await page.locator('main button:visible', { hasText: /^Create product$/ }).click(); await page.waitForTimeout(3000);
  return (await page.locator('[role=alert]:visible, .Mui-error:visible').allInnerTexts()).join(' | ');
});
await note('excursion add pax band overlapping 1-10 & 5-20 + Create', async () => {
  await page.getByPlaceholder('Min').fill(''); await page.getByPlaceholder('Max').fill('');
  for (let i = 0; i < 2; i++) await page.locator('main button:visible', { hasText: /^Add pax band$/ }).click();
  await page.waitForTimeout(500);
  const f = i => page.getByRole('spinbutton', { name: `Band ${i} from` }), t = i => page.getByRole('spinbutton', { name: `Band ${i} to` });
  await f(1).fill('1'); await t(1).fill('10'); await f(2).fill('5'); await t(2).fill('20');
  await page.locator('main button:visible', { hasText: /^Create product$/ }).click(); await page.waitForTimeout(3000);
  return (await page.locator('[role=alert]:visible, .Mui-error:visible').allInnerTexts()).join(' | ');
});
await toProduct('Excursion');
await page.getByRole('button', { name: 'Jungle Safari Abu Dhabi', exact: true }).last().click(); await page.waitForTimeout(3500);
await note('jungle safari buttons (view)', btns);
await note('jungle safari Table view', async () => { await page.getByRole('button', { name: 'Table view' }).click(); await page.waitForTimeout(2000); return page.locator('main table:visible').last().innerText().then(s => s.replace(/\s+/g, ' ').slice(0, 400)); });

fs.writeFileSync(`${DIR}/probe.txt`, log.join('\n') + '\n\nSENT:\n' + sent.join('\n'));
console.log(log.join('\n') + '\n\nSENT:\n' + sent.join('\n'));
await browser.close();
