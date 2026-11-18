// Helper (not a test): READ-ONLY look at how Supplier / Agent / other modules do Add / Edit / Deactivate / errors,
// to compare with the Core standard (all saves blocked).  Run: node scripts/probe-consistency.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
const DIR = process.argv[2] ?? 'consistency-probe';
fs.mkdirSync(DIR, { recursive: true });
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => { const m = r.request().method(); if (['POST','PUT','DELETE','PATCH'].includes(m) && !/negotiate|\/auth\//.test(r.request().url())) { sent.push(`${m} ${r.request().url()}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const clean = a => a.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const errors = async (scope) => clean(await scope.locator('.Mui-error:visible, .MuiFormHelperText-root:visible, [role=alert]:visible, .MuiAlert-root:visible, .Toastify__toast:visible, .notistack-Snackbar:visible').allInnerTexts());

// top-level menu
await page.goto('/dashboard');
const nav = page.locator('nav, aside').first();
await nav.getByRole('button').first().waitFor({ timeout: 90_000 });
await wait(3000);
log('NAV', clean(await nav.getByRole('button').allInnerTexts()));

async function list(path, tag) {
  console.log(`\n===== ${tag} ${path}`);
  await page.goto(path);
  await page.locator('main tbody tr:visible, main :text("no records")').first().waitFor({ timeout: 90_000 }).catch(() => {});
  await wait(2500);
  log('HEADINGS', clean(await page.getByRole('heading').allInnerTexts()));
  log('MAIN BUTTONS', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 25));
  log('ARIA BUTTONS', (await page.locator('main button:visible[aria-label]').evaluateAll(e => e.map(x => x.getAttribute('aria-label')))).slice(0, 20));
  log('HEADERS', clean(await page.locator('main th:visible').allInnerTexts()));
  log('HEADER INPUTS', await page.locator('main thead input:visible').evaluateAll(e => e.map(x => [x.type, x.placeholder, x.value].join('|'))));
  log('ROW SWITCHES', await page.locator('main tbody tr:visible input[type=checkbox]').evaluateAll(e => e.slice(0, 3).map(x => x.getAttribute('aria-label'))));
  log('FIRST ROW', clean((await page.locator('main tbody tr:visible').allInnerTexts()).slice(0, 2)));
  log('RANGE', clean(await page.getByText(/^\d+–\d+ of [\d,]+$|^Page \d+ of \d+$/).allInnerTexts()));
  // active/status filter options
  const combo = page.locator('main thead [role=combobox]:visible');
  log('HEADER COMBOS', await combo.count());
  for (let i = 0; i < await combo.count(); i++) {
    await combo.nth(i).click().catch(() => {}); await wait(800);
    log(`  combo ${i} options`, clean(await page.getByRole('option').allInnerTexts()));
    await page.keyboard.press('Escape'); await wait(300);
  }
  // empty search
  const search = page.locator('main thead input[type=text]:visible').first();
  if (await search.count()) { await search.fill('zzzqqq'); await wait(3000); log('EMPTY MSG', (await page.locator('main tbody').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)); await search.fill(''); await wait(1500); }
  // audit history
  const audit = page.getByRole('button', { name: 'Audit history' }).first();
  if (await audit.isVisible().catch(() => false)) {
    await audit.click(); await wait(2500);
    const d = page.getByRole('dialog').last();
    log('AUDIT TABS', clean(await d.getByRole('tab').allInnerTexts()).concat(clean(await d.locator('button').allInnerTexts())).slice(0, 12));
    log('AUDIT LINES', (await d.innerText()).split('\n').filter(l => / (created|updated|deactivated) /.test(l)).slice(0, 3));
    await page.keyboard.press('Escape'); await wait(800);
  } else log('AUDIT', 'none');
  await page.screenshot({ path: `${DIR}/${tag}-list.png` });
}

async function addEmpty(path, addName, tag) {
  console.log(`\n----- ${tag} add (empty save)`);
  await page.goto(path); await wait(4000);
  const add = page.locator('main').getByRole('button', { name: addName }).first();
  await add.click({ timeout: 60_000 }); await wait(2500);
  const dlg = page.locator('.MuiDialog-paper:visible').last();
  const isDlg = await dlg.isVisible().catch(() => false);
  log('OPENS AS', isDlg ? 'dialog: ' + (await dlg.locator('h2, .MuiDialogTitle-root').first().innerText().catch(() => '')) : 'page ' + page.url() + ' ' + JSON.stringify(clean(await page.getByRole('heading').allInnerTexts())));
  const scope = isDlg ? dlg : page.locator('main');
  log('LABELS', clean(await scope.locator('label:visible, .MuiFormLabel-root:visible').allInnerTexts()).slice(0, 30));
  log('BUTTONS', clean(await scope.getByRole('button').allInnerTexts()).slice(0, 15));
  log('CLOSE ×', await scope.locator('button[aria-label=Close], button[aria-label=close]').count());
  const save = scope.getByRole('button', { name: /^(Save|Create|Add|Submit)/ }).last();
  log('SAVE ENABLED', await save.isEnabled().catch(() => 'n/a'));
  const before = sent.length;
  await save.click({ timeout: 5000 }).catch(e => log('SAVE CLICK', 'failed ' + e.message.slice(0, 60)));
  await wait(2500);
  log('ERRORS', await errors(page.locator('body')));
  log('RED FIELDS', await scope.locator('.Mui-error:visible').count());
  log('SENT ON EMPTY SAVE', sent.slice(before));
  await page.screenshot({ path: `${DIR}/${tag}-add-empty.png` });
  // spaces-only name + very long name
  const first = scope.locator('input[type=text]:visible, input:not([type]):visible').first();
  if (await first.count()) {
    await first.fill('A'.repeat(300)); log('FIRST INPUT 300 -> len', (await first.inputValue()).length);
  }
  await page.keyboard.press('Escape'); await wait(800);
  log('ESC CLOSES', isDlg ? !(await dlg.isVisible().catch(() => false)) : 'n/a');
}

async function rowClick(path, tag) {
  console.log(`\n----- ${tag} row click / deactivate`);
  await page.goto(path);
  await page.locator('main tbody tr:visible').first().waitFor({ timeout: 90_000 });
  await wait(2000);
  const row = page.locator('main tbody tr:visible').first();
  await row.locator('td').first().click(); await wait(3000);
  const dlg = page.locator('.MuiDialog-paper:visible').last();
  log('ROW CLICK', (await dlg.isVisible().catch(() => false)) ? 'dialog ' + (await dlg.innerText()).split('\n')[0] : 'page ' + page.url() + ' ' + JSON.stringify(clean(await page.getByRole('heading').allInnerTexts()).slice(0, 3)));
  log('DETAIL BUTTONS', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 20));
  await page.screenshot({ path: `${DIR}/${tag}-row-click.png` });
  await page.goto(path); await page.locator('main tbody tr:visible').first().waitFor({ timeout: 90_000 }); await wait(2000);
  const sw = page.locator('main tbody tr:visible input[type=checkbox]:checked').first();
  if (await sw.count()) {
    await sw.click(); await wait(1500);
    const pop = page.locator('.swal2-popup:visible, .MuiDialog-paper:visible').last();
    log('SWITCH POPUP', (await pop.isVisible().catch(() => false)) ? { cls: (await pop.getAttribute('class'))?.slice(0, 80), text: clean([await pop.innerText()]) } : 'no popup');
    await page.screenshot({ path: `${DIR}/${tag}-switch.png` });
    await page.keyboard.press('Escape');
    const cancel = page.locator('.swal2-popup:visible, .MuiDialog-paper:visible').getByRole('button', { name: 'Cancel' });
    if (await cancel.count()) await cancel.first().click().catch(() => {});
  } else log('SWITCH', 'no row switch');
}

const target = process.argv[3] ?? 'all';
const run = async (fn) => { try { await fn(); } catch (e) { console.log('!! ' + e.message.split('\n')[0]); } };
if (target === 'all' || target === 'core') { await run(() => list('/countries', 'core-country')); await run(() => addEmpty('/states', 'Add State', 'core-state')); await run(() => rowClick('/states', 'core-state')); }
if (target === 'all' || target === 'supplier') { await run(() => list('/suppliers', 'supplier')); await run(() => addEmpty('/suppliers', /Add supplier/, 'supplier')); await run(() => rowClick('/suppliers', 'supplier')); }
if (target === 'all' || target === 'agent') { await run(() => list('/agents', 'agent')); await run(() => addEmpty('/agents', /Add agent/, 'agent')); await run(() => rowClick('/agents', 'agent')); }
log('\nSENT (all blocked)', sent.length);
await browser.close();
