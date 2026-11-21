// Helper (not a test): creates / completes the standing B2B test agent "QA Auto B2B Agent" (REAL saves, asked for by the user 20 Nov 2026).
//   Approved, UAE, AED, credit allowed with limit 50,000, ALL products, ALL portal menus.
//   It is NOT blocked afterwards (B2B tests need it). The portal password is NOT set here - the user sets it
//   (Agent > Access > Portal login) and puts Login ID / password in .env (B2B_LOGIN_CREDIT / B2B_PASSWORD_CREDIT).
//   node scripts/data/create-b2b-agent.mjs
import { open } from '../lib/probe-lib.mjs';
const NAME = 'QA Auto B2B Agent';
const EMAIL = 'qa.auto.b2b.agent@example.com';
const log = [];
const { browser, page } = await open({ allowWrites: true, log });
const btn = (n, scope = page.locator('main')) => scope.locator('button:visible', { hasText: new RegExp(`^${n}$`) }).last();
const saved = async (click) => { const r = page.waitForResponse(x => /pilottest/.test(x.url()) && ['POST', 'PUT', 'PATCH'].includes(x.request().method()) && !/negotiate|auth|search/.test(x.url()), { timeout: 60000 }); await click(); const res = await r; return `${res.status()} ${res.request().method()} ${res.url().replace(/^https:\/\/[^/]+/, '')}`; };

// 1. find it (all rows on one page) or create it
await page.goto('/agents');
await page.getByRole('heading', { name: 'Agents' }).first().waitFor({ timeout: 90000 });
await page.waitForTimeout(2500);
const perPage = page.locator('main').getByRole('combobox').filter({ hasText: /^\d+$/ }).last();
if (await perPage.count()) { await perPage.click(); await page.getByRole('option').last().click(); await page.waitForTimeout(2500); }
let row = page.locator('main tbody tr', { hasText: NAME });
let agentUrl;
if (await row.count()) {
  await row.first().locator('td').first().click();
  await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 60000 });
  agentUrl = page.url().replace(/\/(overview|edit|access).*/, '');
  console.log('exists: ' + agentUrl);
} else {
  await page.getByRole('button', { name: 'Add Agent', exact: true }).click();
  await page.getByRole('heading', { name: 'Add agent' }).waitFor({ timeout: 60000 });
  await page.locator('main input[placeholder="Agent name"]:visible').fill(NAME);
  await page.locator('main input[placeholder="agency@example.com"]:visible').fill(EMAIL);
  await page.locator('main input[placeholder="Exchange type"]').click(); await page.getByRole('option').first().click();
  await page.locator('main input[placeholder="Country"]:visible').first().click(); await page.keyboard.type('United Arab', { delay: 30 });
  await page.getByRole('option', { name: 'United Arab Emirates', exact: true }).click();
  await page.locator('main input[placeholder="Select currency"]').click(); await page.getByRole('option', { name: 'UAE Dirham' }).click();
  await page.locator('main input[aria-label="Allow credit"]').click();
  await page.locator('main input[aria-label="Credit limit"]').fill('50000');
  console.log('create: ' + await saved(() => page.getByRole('button', { name: 'Create agent', exact: true }).click()));
  await page.getByRole('tab', { name: 'Overview', exact: true }).first().waitFor({ timeout: 60000 });
  agentUrl = page.url().replace(/\/(overview|edit|access).*/, '');
  console.log('created: ' + agentUrl);
}

// 2. Approved
await page.goto(`${agentUrl}/overview`); await page.waitForTimeout(3000);
const status = page.locator('main input[value="Approved"], main input[value="On Hold"], main input[value="Blocked"]').first();
if ((await status.inputValue()) !== 'Approved') {
  await btn('Edit').click();
  await status.click(); await page.getByRole('option', { name: 'Approved', exact: true }).click();
  console.log('approve: ' + await saved(() => btn('Save').click()));
} else console.log('already Approved');

// 3. Access: ALL products, ALL portal menus
await page.goto(`${agentUrl}/access`); await page.waitForTimeout(3500);
for (const section of ['Products', 'Portal menus']) {
  const main = page.locator('main');
  const counter = await main.innerText();
  const m = counter.replace(/\s+/g, ' ').match(new RegExp(`${section} (?:All )?(\\d+) of (\\d+) on|${section} All (\\d+) on`));
  if (m && (m[3] || m[1] === m[2])) { console.log(`${section}: already all on`); continue; }
  await page.locator(`main button[aria-label="Edit ${section}"]`).click();
  await page.waitForTimeout(1000);
  await main.getByRole('button', { name: 'All', exact: true }).first().click();
  console.log(`${section} all: ` + await saved(() => main.getByRole('button', { name: 'Save', exact: true }).first().click()));
  await page.waitForTimeout(2000);
}
await page.reload(); await page.waitForTimeout(3500);
const t = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('ACCESS: ' + (t.match(/Products.{0,25}/)?.[0] ?? '') + ' | ' + (t.match(/Portal menus.{0,20}/)?.[0] ?? '') + ' | ' + (t.match(/Portal login.{0,60}/)?.[0] ?? ''));
await page.goto(`${agentUrl}/financials`); await page.waitForTimeout(3500);
console.log('FINANCIALS: ' + (await page.locator('main').innerText()).replace(/\s+/g, ' ').match(/Credit.{0,200}/)?.[0]);
console.log('AGENT: ' + agentUrl);
await browser.close();
