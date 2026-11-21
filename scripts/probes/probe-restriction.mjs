// Helper (not a test). Approved by the user on 13-Nov-2026: creates ONE restriction group
// "QA Auto RG <stamp>" (Create & Continue) and records what the permission editor looks like.
// Nothing else is saved: after the group is created, every write is blocked again.
// Run:  node scripts/probes/probe-restriction.mjs out.json
import { chromium } from '@playwright/test';
import fs from 'fs';

const out = {};
const clean = s => s.replace(/[​]/g, '').replace(/\n{2,}/g, '\n').trim();
const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? 'https://erp.nexgenpilot.com', viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
let allowOneWrite = false;
const sent = [];
await ctx.route('**/pilottest.runasp.net/**', r => {
  const m = r.request().method();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) || r.request().url().includes('negotiate')) return r.continue();
  sent.push(`${m} ${r.request().url()} ${allowOneWrite ? 'ALLOWED' : 'blocked'} ${r.request().postData()?.slice(0, 300) ?? ''}`);
  if (allowOneWrite) { allowOneWrite = false; return r.continue(); }
  return r.abort();
});
const page = await ctx.newPage();
const dump = async key => {
  await page.waitForTimeout(4000);
  out[key] = {
    url: page.url(),
    main: clean(await page.locator('main').innerText()).slice(0, 6000),
    dialog: await page.getByRole('dialog').count() ? clean(await page.getByRole('dialog').last().innerText()).slice(0, 6000) : null,
    buttons: (await page.getByRole('button').allInnerTexts()).map(s => s.trim()).filter(Boolean),
    inputs: await page.locator('main input, [role=dialog] input').evaluateAll(els => els.map(e => `${e.type} ${e.name || ''} ${e.placeholder || ''} ${e.getAttribute('aria-label') || ''} ${e.checked ? 'checked' : ''} ${e.disabled ? 'disabled' : ''}`)),
  };
  await page.screenshot({ path: `${process.argv[2]}.${key}.png`, fullPage: true });
};

try {
  // 1) Add User dropdowns (nothing saved)
  await page.goto('/users');
  await page.getByRole('button', { name: 'Add User' }).click({ timeout: 90_000 });
  const u = page.getByRole('dialog').last();
  for (const f of ['Department', 'Reports To', 'Restriction Group', 'City']) {
    await u.getByText(new RegExp(`^${f}\\s*\\*?$`)).first().locator('xpath=following::input[1]').click();
    await page.waitForTimeout(2500);
    out['user:' + f] = await page.getByRole('option').allInnerTexts();
    await page.keyboard.press('Escape');
  }
  await u.getByRole('button', { name: 'Cancel' }).click();

  // 2) Create the restriction group (the ONE allowed write)
  const name = 'QA Auto RG ' + Array.from({ length: 6 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  out.groupName = name;
  await page.goto('/restrictions');
  await page.getByRole('button', { name: 'Add Group' }).click({ timeout: 90_000 });
  const d = page.getByRole('dialog').last();
  await d.locator('input').first().fill(name);
  allowOneWrite = true;
  await d.getByRole('button', { name: 'Create & Continue' }).click();
  await page.waitForTimeout(8000);
  await dump('afterCreate');

  // 3) Open every expandable part of the editor so we see all permission rows (no saving)
  for (const b of await page.locator('main button[aria-expanded=false]').all()) await b.click().catch(() => {});
  await dump('expanded');
} catch (e) { out.error = String(e); await dump('error').catch(() => {}); }
out.sent = sent;
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
await browser.close();
