// Helper (not a test): READ-ONLY - empty-save / invalid-value messages in every Supplier + Agent form, and a first look at
// the other menu modules, to compare with the Core standard (all saves blocked).  Run: node scripts/probe-consistency2.mjs <outDir> [forms|modules]
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
const clean = a => a.map(s => s.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
const wait = ms => page.waitForTimeout(ms);
const log = (k, v) => console.log(k + ':', typeof v === 'string' ? v : JSON.stringify(v));
const target = process.argv[3] ?? 'forms';
const run = async (name, fn) => { console.log(`\n----- ${name}`); try { await fn(); } catch (e) { console.log('!! ' + e.message.split('\n')[0]); } await page.keyboard.press('Escape').catch(() => {}); };
const vbtn = (name, scope = page.locator('main')) => scope.getByRole('button', { name, exact: true }).locator('visible=true').first();
const dlg = () => page.locator('.MuiDialog-paper:visible').last();

/** what the user sees after an empty / wrong save: messages, red fields, banners, toasts */
async function feedback(tag, scope) {
  await wait(2500);
  const helper = clean(await scope.locator('.MuiFormHelperText-root.Mui-error:visible, p.Mui-error:visible').allInnerTexts());
  const banner = clean(await page.locator('.MuiAlert-root:visible, [role=alert]:visible').allInnerTexts());
  const toast = clean(await page.locator('.Toastify__toast:visible, .notistack-Snackbar:visible, .MuiSnackbar-root:visible, .swal2-popup:visible').allInnerTexts());
  const red = await scope.locator('.MuiInputBase-root.Mui-error:visible, .MuiOutlinedInput-root.Mui-error:visible').count();
  const redLabels = clean(await scope.locator('label.Mui-error:visible, .MuiFormLabel-root.Mui-error:visible').allInnerTexts());
  log('  helper texts', helper); log('  banners', banner); log('  toasts', toast); log('  red inputs', red); log('  red labels', redLabels);
  await page.screenshot({ path: `${DIR}/${tag}.png` });
}
async function emptySave(tag, openFn, saveName = /^(Save|Create|Add|Submit)/) {
  await openFn();
  await wait(1500);
  const d = dlg();
  const isDlg = await d.isVisible().catch(() => false);
  const scope = isDlg ? d : page.locator('main');
  log('  opens as', isDlg ? 'dialog "' + clean([await d.locator('h2, .MuiDialogTitle-root').first().innerText().catch(() => '')])[0] + '"' : 'page ' + page.url());
  log('  buttons', clean(await scope.getByRole('button').allInnerTexts()).slice(-6));
  log('  × close', await scope.locator('button[aria-label=Close], button[aria-label=close]').count());
  const labels = clean(await scope.locator('label:visible, .MuiFormLabel-root:visible').allInnerTexts());
  log('  labels', labels.slice(0, 20));
  const save = scope.getByRole('button', { name: saveName }).last();
  const enabled = await save.isEnabled().catch(() => 'n/a');
  log('  save enabled when empty', enabled);
  const before = sent.length;
  if (enabled === true) await save.click().catch(() => {});
  await feedback(tag, scope);
  log('  sent', sent.slice(before));
  return scope;
}

if (target === 'forms') {
  const SUP = 18;
  await run('supplier: Add contact', () => emptySave('sup-contact', async () => { await page.goto(`/suppliers/${SUP}/contacts`); await vbtn(/Add contact$/).click({ timeout: 90_000 }); }));
  await run('supplier: Add bank account', () => emptySave('sup-bank', async () => { await page.goto(`/suppliers/${SUP}/financials`); await vbtn('Add bank account').click({ timeout: 90_000 }); }));
  await run('supplier: Add currency', () => emptySave('sup-currency', async () => { await page.goto(`/suppliers/${SUP}/financials`); await page.getByRole('button', { name: /Add currency$/ }).last().click({ timeout: 90_000 }); }));
  await run('supplier: invalid email in contact', async () => {
    await page.goto(`/suppliers/${SUP}/contacts`); await vbtn(/Add contact$/).click({ timeout: 90_000 });
    await dlg().getByPlaceholder('name@company.com').fill('abc'); await dlg().getByRole('button', { name: 'Save' }).click(); await feedback('sup-contact-bad-email', dlg());
  });
  await run('supplier: Edit basic details, clear name', async () => {
    await page.goto(`/suppliers/${SUP}/overview`); await vbtn('Edit').click({ timeout: 90_000 }); await wait(1500);
    const name = page.locator('main input:visible').first(); log('  first input value', await name.inputValue());
    await name.fill(''); log('  save', clean(await page.locator('main').getByRole('button', { name: /^(Save|Save changes|Update)/ }).allInnerTexts()));
    await page.locator('main').getByRole('button', { name: /^(Save|Save changes|Update)/ }).last().click(); await feedback('sup-edit-empty-name', page.locator('main'));
  });
  await run('supplier: Add room (product)', () => emptySave('sup-room', async () => { await page.goto(`/suppliers/${SUP}/products`); await wait(4000); await vbtn('Hotel').click().catch(() => {}); await wait(2000); await page.locator('main').getByRole('button', { name: /^Add room/ }).first().click(); }, /^(Save|Create)/));
  await run('supplier: Add contract', () => emptySave('sup-contract', async () => { await page.goto(`/suppliers/${SUP}/products`); await wait(4000); await vbtn('Hotel').click().catch(() => {}); await wait(2000); await vbtn('Contract').click(); await wait(2000); await page.locator('main').getByRole('button', { name: /Add contract/i }).last().click(); }, /^(Save|Create)/));
  await run('agent: Add Agent', () => emptySave('agent-add', async () => { await page.goto('/agents'); await vbtn(/^Add Agent$/i).click({ timeout: 90_000 }); }, /^(Save|Create)/));
  await run('agent: Add currency', () => emptySave('agent-currency', async () => { await page.goto('/agents/6/financials'); await wait(4000); await vbtn('Add currency').click({ timeout: 90_000 }); }));
  await run('agent: Add top-up', () => emptySave('agent-topup', async () => { await page.goto('/agents/6/financials'); await wait(4000); await vbtn('Add top-up').click({ timeout: 90_000 }); }));
  await run('agent: Add address/contact?', async () => { await page.goto('/agents/6/overview'); await wait(5000); log('  overview buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 40)); log('  tabs', clean(await page.getByRole('tab').allInnerTexts())); });
}

if (target === 'modules') {
  for (const m of ['Company', 'Accounts', 'System', 'Product Search', 'Portal CMS', 'Contracts', 'Package', 'Enquiries', 'Quotes', 'Reservation', 'Amendment Requests', 'Feedback', 'Reports']) {
    await run('module ' + m, async () => {
      await page.goto('/dashboard');
      const nav = page.locator('nav, aside').first();
      await nav.getByRole('button', { name: m, exact: true }).first().click({ timeout: 90_000 }); await wait(4000);
      log('  url', page.url());
      log('  submenu', clean(await nav.getByRole('button').allInnerTexts()).slice(0, 40));
      log('  headings', clean(await page.getByRole('heading').allInnerTexts()).slice(0, 5));
      log('  main buttons', clean(await page.locator('main').getByRole('button').allInnerTexts()).slice(0, 15));
      log('  headers', clean(await page.locator('main th:visible').allInnerTexts()));
      log('  switches', await page.locator('main tbody input[type=checkbox]:visible').count());
      await page.screenshot({ path: `${DIR}/module-${m.replace(/ /g, '-')}.png` });
    });
  }
}
log('\nSENT (all blocked)', sent.length);
await browser.close();
