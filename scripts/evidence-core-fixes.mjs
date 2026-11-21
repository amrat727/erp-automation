// Helper (not a test): READ-ONLY fix screenshots for the core bugs found FIXED in the 21 Nov 2026 core rerun.
// Every save is BLOCKED by probe-lib; popups are always Cancelled, dialogs closed with Escape.
//   -> screenshots/revalidation/<BUG>-fixed.png (green outline) + reports/Linear/core-fixes-21nov.json
//   ONLY=BUG-09,BUG-22 node scripts/evidence-core-fixes.mjs   re-runs just those
import { open } from './probe-lib.mjs';
import fs from 'fs';

const OUT = 'screenshots/revalidation', JSON_PATH = 'reports/Linear/core-fixes-21nov.json';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(30000);
const C = '#16a34a';
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
const results = [];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const mark = async (l, color = C) => {
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.evaluate((e, c) => { e.style.outline = `3px solid ${c}`; e.style.outlineOffset = '2px'; }, color).catch(() => {});
};
const label = text => page.evaluate(([t, c]) => {
  const d = document.createElement('div'); d.textContent = t;
  Object.assign(d.style, { position: 'fixed', top: '12px', right: '12px', zIndex: 2147483647, background: c, color: '#fff', font: 'bold 16px sans-serif', padding: '6px 12px', borderRadius: '6px', maxWidth: '700px' });
  document.body.appendChild(d);
}, [text, C]);
const rows = () => page.locator('tbody tr').filter({ has: page.locator('input[type=checkbox]') });
async function openList(path) {
  await page.goto(path);
  if (/login/.test(page.url())) throw new Error('session expired: ' + page.url());
  await rows().first().or(page.getByText(/no records|yet\./i).first()).waitFor({ timeout: 90000 });
  await page.waitForTimeout(1200);
}
async function nameSearch(text) {
  const box = page.locator('main thead input[placeholder="Search name"]').first();
  if (!(await box.isVisible().catch(() => false))) {
    // stage 21 Nov: clicking the column title opens its filter
    await page.locator('thead th:has(input[placeholder="Search name"])').first().click({ position: { x: 30, y: 15 }, force: true });
    await box.waitFor({ state: 'visible', timeout: 10000 });
  }
  await box.fill(text);
  await page.waitForTimeout(2500);
}
const addDialog = async (button, title) => {
  await page.getByRole('button', { name: button, exact: true }).click();
  const dlg = page.getByRole('dialog').filter({ hasText: title }).last();
  await dlg.waitFor();
  return dlg;
};
const field = (dlg, lbl) => dlg.getByText(new RegExp(`^${lbl}\\s*\\*?$`)).first().locator('xpath=following::input[1]');
const close = async () => { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); };

async function item(bug, fn) {
  if (ONLY && !ONLY.includes(bug)) return;
  const file = `${OUT}/${bug}-fixed.png`;
  try {
    const { observed, ok } = await fn(file);
    results.push({ bug, file, observed, ok });
    console.log(`${bug} | ${ok ? 'FIXED' : 'NOT FIXED'} | ${observed}`);
  } catch (e) {
    results.push({ bug, file: 'FAILED', observed: 'FAILED: ' + clean(e.message).slice(0, 200), ok: false });
    console.log(`${bug} | FAILED | ${clean(e.message).slice(0, 200)}`);
  }
  await close();
}

// digits kept while typing (BUG-09 Region, BUG-22 Product, BUG-113 Application / Organization)
for (const [bug, path, btn, title] of [
  ['BUG-09', '/states', 'Add State', 'Add State'],
  ['BUG-22', '/producttype', 'Add Product Type', 'Add Product Type'],
  ['BUG-113', '/organization/branches', 'Add Branch', 'Add Branch'],
]) {
  await item(bug, async file => {
    await openList(path);
    const dlg = await addDialog(btn, title);
    const name = field(dlg, 'Name');
    await name.pressSequentially('Zone 2 North-1 & Co (Test), Ltd./A');
    const v = await name.inputValue();
    await mark(name); await label(`typed "Zone 2 North-1 & Co (Test), Ltd./A" -> kept "${v}"`);
    await page.screenshot({ path: file });
    return { observed: `${title}: typed "Zone 2 North-1 & Co (Test), Ltd./A", Name shows "${v}"`, ok: v === 'Zone 2 North-1 & Co (Test), Ltd./A' };
  });
}

// required messages on an empty save (blocked anyway)
for (const [bug, path, btn, title, fieldName] of [
  ['BUG-11', '/states', 'Add State', 'Add State', 'Country'],
  ['BUG-23', '/producttype', 'Add Product Type', 'Add Product Type', 'Product'],
  ['BUG-24', '/supplements', 'Add Supplement', 'Add Supplement', 'Product Type'],
  ['BUG-41', '/resources/personnel', 'Add Personnel', 'Add Personnel', 'Personnel Type'],
  ['BUG-31', '/languages', 'Add Language', 'Add Language', 'Name'],
  ['BUG-32', '/tax', 'Add Tax', 'Add Tax', 'Name'],
]) {
  await item(bug, async file => {
    await openList(path);
    const dlg = await addDialog(btn, title);
    const before = log.length;
    await dlg.getByRole('button', { name: /^(Save|Create|Add)$/ }).last().click();
    await page.waitForTimeout(1500);
    const msg = dlg.getByText(new RegExp(`^${fieldName} is required\\.?$`)).first();
    const shown = await msg.isVisible().catch(() => false);
    const all = (await dlg.locator('.MuiFormHelperText-root, .Mui-error').allInnerTexts()).map(clean).filter(Boolean);
    const sent = log.length - before;
    if (shown) await mark(msg);
    await label(`empty Save -> "${shown ? clean(await msg.innerText()) : 'no message'}"${sent ? '' : ', nothing sent to the server'}`);
    await page.screenshot({ path: file });
    return { observed: `${title}, empty Save: messages [${[...new Set(all)].join(' | ')}]; requests sent: ${sent}`, ok: shown && (bug !== 'BUG-31' || sent === 0) };
  });
}

// Account Group: Name checked in the browser too (part of BUG-31)
await item('BUG-31b', async file => {
  await openList('/accountgroup');
  const dlg = await addDialog('Add Account Group', 'Add Account Group');
  const before = log.length;
  await dlg.getByRole('button', { name: /^(Save|Create|Add)$/ }).last().click();
  await page.waitForTimeout(1500);
  const msg = dlg.getByText(/^Name is required\.?$/).first();
  const shown = await msg.isVisible().catch(() => false);
  if (shown) await mark(msg);
  await label(`empty Save -> ${shown ? '"Name is required"' : 'no message'}, requests sent: ${log.length - before}`);
  await page.screenshot({ path: file });
  return { observed: `Add Account Group, empty Save: "Name is required" shown: ${shown}; requests sent: ${log.length - before}`, ok: shown && log.length === before };
});

// Tax Name takes 150 characters (BUG-33)
await item('BUG-33', async file => {
  await openList('/tax');
  const dlg = await addDialog('Add Tax', 'Add Tax');
  const name = field(dlg, 'Name');
  await name.fill('x'.repeat(160));
  const len = (await name.inputValue()).length;
  await mark(name); await label(`typed 160 characters -> Name keeps ${len}`);
  await page.screenshot({ path: file });
  return { observed: `Add Tax: typed 160 "x", Name keeps ${len}`, ok: len === 150 };
});

// Desk Location: Audit history, Name search, Active filter (BUG-12)
await item('BUG-12', async file => {
  await openList('/desk-locations');
  const audit = page.getByRole('button', { name: 'Audit history' });
  const hasAudit = await audit.isVisible().catch(() => false);
  const nameTh = page.locator('thead th:has(input[placeholder="Search name"])');
  const activeTh = page.locator('thead th:has([aria-label="Clear Active filter"])');
  const hasName = await nameTh.count(), hasActive = await activeTh.count();
  if (hasAudit) await mark(audit); if (hasName) await mark(nameTh.first()); if (hasActive) await mark(activeTh.first());
  await nameSearch('zzzqqq');
  const empty = page.getByText(/^There are no records in /).first();
  const emptyText = (await empty.isVisible().catch(() => false)) ? clean(await empty.innerText()) : '(none)';
  if (emptyText !== '(none)') await mark(empty);
  await label(`Audit history: ${hasAudit ? 'yes' : 'no'}, Name search: ${hasName ? 'yes' : 'no'}, Active filter: ${hasActive ? 'yes' : 'no'}; empty: "${emptyText}"`);
  await page.screenshot({ path: file });
  return { observed: `Desk Location: Audit history ${hasAudit}, Name search ${!!hasName}, Active filter ${!!hasActive}, empty search "${emptyText}"`, ok: hasAudit && hasName && hasActive && /Desk Location/.test(emptyText) };
});

// Department popup names the department (BUG-30) - opened and CANCELLED
await item('BUG-30', async file => {
  await openList('/organization/departments');
  const sw = rows().locator('input[type=checkbox]:checked').first();
  await sw.click({ force: true });
  const pop = page.locator('.swal2-popup:visible');
  await pop.waitFor();
  const text = clean(await pop.innerText());
  await mark(pop); await page.screenshot({ path: file });
  await pop.getByRole('button', { name: /cancel/i }).click();
  return { observed: `Department deactivate popup: "${text}" (cancelled)`, ok: /department/i.test(text) && !/branch/i.test(text) };
});

// Role screen: /contacttype -> /roles, heading "Roles" (BUG-36)
await item('BUG-36', async file => {
  await page.goto('/contacttype');
  await rows().first().waitFor({ timeout: 90000 });
  const h = page.getByRole('heading', { name: /^Roles?\b/ }).first();
  const ht = clean(await h.innerText());
  await mark(h); await label(`opened /contacttype -> ${page.url().replace(/^https?:\/\/[^/]+/, '')}, heading "${ht}"`);
  await page.screenshot({ path: file });
  return { observed: `/contacttype opens ${page.url().replace(/^https?:\/\/[^/]+/, '')} with heading "${ht}"`, ok: /\/roles$/.test(page.url()) && ht === 'Roles' };
});

// Product menu singular (BUG-21) - and what the Resource menu still says
await item('BUG-21', async file => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Core', exact: true }).click();
  await page.getByRole('button', { name: 'Product', exact: true }).click();
  await page.waitForTimeout(800);
  const items = ['Product Type', 'Product Class', 'Room Type', 'View Type', 'Room Category', 'Supplement', 'Allotment', 'Addon', 'Excursion Setup', 'Amenity'];
  const seen = [];
  for (const n of items) { const b = page.getByRole('button', { name: n, exact: true }); if (await b.isVisible().catch(() => false)) { seen.push(n); await mark(b); } }
  await label(`Product menu: ${seen.length}/${items.length} items singular`);
  await page.screenshot({ path: file });
  return { observed: `Product menu items (singular): ${seen.join(', ')}`, ok: seen.length === items.length };
});

// trimmed + & ( ) kept on save (BUG-26 Product, BUG-113 Region): records saved by today's test run (QA Auto ..., deactivated)
await item('BUG-26', async file => {
  await openList('/producttype');
  await nameSearch('Edge & Co (Test)');
  const cell = rows().locator('td').filter({ hasText: /QA Auto .*Edge & Co \(Test\)$/ }).first();
  await cell.waitFor({ timeout: 20000 });
  const t = await cell.innerText();
  await mark(cell); await label(`saved by today's run as "${t}" - trimmed, & ( ) kept`);
  await page.screenshot({ path: file });
  return { observed: `Product Type record saved by the 21 Nov run: "${t}" (typed with spaces around)`, ok: t === t.trim() && /& Co \(Test\)/.test(t) };
});

// Tax Detail: empty Save and a range 1000 -> 10 are checked in the browser (BUG-42)
await item('BUG-42', async file => {
  await openList('/taxdetail');
  const add = page.locator('main').getByRole('button', { name: /^Add Tax Detail$/ });
  await add.click();
  const dlg = page.getByRole('dialog').last();
  await dlg.waitFor();
  const before = log.length;
  const from = field(dlg, 'Range From'), to = field(dlg, 'Range To');
  if (await from.count()) await from.fill('1000');
  if (await to.count()) await to.fill('10');
  await dlg.getByRole('button', { name: /^(Save|Create|Add)$/ }).last().click();
  await page.waitForTimeout(1500);
  const msgs = [...new Set((await dlg.locator('.MuiFormHelperText-root, .Mui-error, [role=alert]').allInnerTexts()).map(clean).filter(Boolean))];
  const sent = log.length - before;
  for (const m of await dlg.locator('.MuiFormHelperText-root').all()) await mark(m);
  await label(`Save with empty fields + range 1000 -> 10: ${msgs.length} messages, requests sent: ${sent}`);
  await page.screenshot({ path: file });
  return { observed: `Add Tax Detail, empty Tax/State/Type and range 1000 -> 10: messages [${msgs.join(' | ')}]; requests sent: ${sent}`, ok: sent === 0 && msgs.length > 0 };
});

// Restriction Groups has Audit history (BUG-35)
await item('BUG-35', async file => {
  await page.goto('/restrictions');
  await page.locator('main').first().waitFor({ timeout: 60000 }); await page.waitForTimeout(3000);
  const audit = page.getByRole('button', { name: 'Audit history' }).first();
  const has = await audit.isVisible().catch(() => false);
  if (has) await mark(audit);
  await label(`Restriction Groups - Audit history button: ${has ? 'yes' : 'no'}`);
  await page.screenshot({ path: file });
  return { observed: `Restriction Groups: "Audit history" button visible: ${has}`, ok: has };
});

// Flex menu vs page heading (BUG-37)
await item('BUG-37', async file => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Core', exact: true }).click();
  await page.getByRole('button', { name: 'Application', exact: true }).click();
  await page.getByRole('button', { name: 'Flex', exact: true }).click();
  await page.waitForTimeout(800);
  const names = (await page.getByRole('button', { name: /^Flex ?\d+$/ }).allInnerTexts()).map(clean);
  const item1 = page.getByRole('button', { name: /^Flex ?1$/ }).first();
  await mark(item1); await item1.click();
  const h = page.getByRole('heading', { name: /^Flex ?1\b/ }).first();
  await h.waitFor({ timeout: 60000 });
  const ht = clean(await h.innerText());
  await mark(h); await label(`menu: ${names.join(', ')} | heading: "${ht}"`);
  await page.screenshot({ path: file });
  return { observed: `Flex menu items: ${names.join(', ')}; Flex 1 page heading "${ht}"`, ok: names[0] === ht.split(' ').slice(0, 2).join(' ') || names.includes(ht) };
});

await browser.close();
fs.writeFileSync(JSON_PATH, JSON.stringify(results, null, 1));
console.log(`BLOCKED WRITES (expected, nothing saved): ${log.length}`);
