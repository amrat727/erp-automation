// Helper (not a test): records what non-standard Core pages show. ALL writes are blocked.
// Run:  node scripts/probe-pages.mjs out.json
import { chromium } from '@playwright/test';
import fs from 'fs';

const PAGES = [
  // [name, path, button to open a form (optional)]
  ['Journals', '/journals', 'New journal voucher'],
  ['Recurring Journals', '/recurringjournals', 'New recurring journal'],
  ['Bank Reconciliation', '/bankreconciliation'],
  ['Agent Invoices', '/agentinvoices', 'Raise invoice'],
  ['Supplier Invoices', '/supplierinvoices', 'Enter supplier invoice'],
  ['Refund Payouts', '/refundpayouts'],
  ['Accounting Settings', '/accountingsettings'],
  ['Financial Periods', '/financialperiods'],
  ['Configurations', '/system/configurations'],
  ['Help Center', '/system/help', 'Add article'],
  ['Data Retention', '/system/data-retention'],
  ['Users', '/users', 'Add User'],
  ['Feedback Questions', '/feedback-questions', 'Add Question'],
  ['Resource Mapping', '/resourcemapping', 'Add Mapping'],
  ['Personnel', '/resources/personnel', 'Add Personnel'],
  ['Restriction Groups', '/restrictions', 'Add Group'],
  ['Exchange Types', '/exchangetypes', 'Add Exchange Type'],
  ['Excursion Setup', '/excursion-setup'],
];
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com' });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
await ctx.route('**/pilottest.runasp.net/**', r => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !r.request().url().includes('negotiate') ? r.abort() : r.continue());
const out = [];
const clean = s => s.replace(/[​]/g, '').replace(/\n{2,}/g, '\n').trim();

// Flex menu items
{
  const page = await ctx.newPage();
  const nav = page.locator('nav, aside').first();
  const flex = [];
  for (let i = 1; i <= 10; i++) {
    try {
      await page.goto('/flex/' + i);                       // same page the menu item Flex<i> opens
      await page.waitForTimeout(8000);
      const h = (await page.getByRole('heading').allInnerTexts()).filter(s => !/^Good /.test(s));
      flex.push({ item: 'Flex' + i, url: new URL(page.url()).pathname, heading: h[0] ?? '', toolbar: (await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 8), rows: await page.locator('tbody tr').count(), firstRows: (await page.locator('tbody tr').allInnerTexts()).slice(0, 3).map(s => s.replace(/\s+/g, ' | ')) });
    } catch (e) { flex.push({ item: 'Flex' + i, error: String(e).slice(0, 150) }); }
    console.log(JSON.stringify(flex.at(-1)));
  }
  out.push({ name: 'Flex', flex });
  await page.close();
}

for (const [name, path, formButton] of PAGES) {
  const page = await ctx.newPage();
  const info = { name, path };
  try {
    await page.goto(path);
    await page.getByRole('heading').filter({ hasNotText: /^Good / }).first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(8000);
    info.main = clean(await page.locator('main').innerText()).slice(0, 1200);
    info.buttons = (await page.locator('main').getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean).slice(0, 25);
    info.inputs = await page.locator('main input, main textarea, main select').evaluateAll(e => e.slice(0, 30).map(x => `${x.tagName.toLowerCase()}[${x.type}] ${x.getAttribute('placeholder') ?? ''} ${x.getAttribute('aria-label') ?? ''} ${x.disabled ? 'disabled' : ''} ${x.checked ? 'checked' : ''} val=${(x.value ?? '').slice(0, 30)}`.trim()));
    if (formButton) {
      await page.locator('main').getByRole('button', { name: formButton }).first().click({ timeout: 10_000 });
      await page.waitForTimeout(3000);
      const dlg = page.getByRole('dialog').last();
      const scope = (await dlg.count()) ? dlg : page.locator('main');
      info.formIn = (await dlg.count()) ? 'dialog' : new URL(page.url()).pathname;
      info.form = clean(await scope.innerText()).slice(0, 1500);
      info.formInputs = await scope.locator('input, textarea, select').evaluateAll(e => e.slice(0, 40).map(x => `${x.tagName.toLowerCase()}[${x.type}] ${x.getAttribute('placeholder') ?? ''} ${x.getAttribute('role') ?? ''} ${x.getAttribute('maxlength') ? 'max=' + x.getAttribute('maxlength') : ''} ${x.required ? 'required' : ''}`.trim()));
      const save = scope.getByRole('button', { name: /^(Save|Create|Submit|Post|Raise|Add)/ }).last();
      if (await save.count()) {
        info.saveButton = (await save.innerText()).trim();
        await save.click().catch(() => {}); await page.waitForTimeout(2000);
        info.afterEmptySave = clean(await scope.innerText().catch(() => '')).slice(0, 1500);
        info.toasts = (await page.locator('[role=alert], .MuiAlert-message, .Toastify__toast').allInnerTexts()).map(s => s.trim()).filter(Boolean);
      }
    }
  } catch (e) { info.error = String(e).slice(0, 200); }
  out.push(info);
  console.log(JSON.stringify(info).slice(0, 3000));
  await page.close();
}
fs.writeFileSync(process.argv[2] || 'pages.json', JSON.stringify(out, null, 2));
await browser.close();
