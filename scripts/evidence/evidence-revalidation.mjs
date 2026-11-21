// Helper (not a test): READ-ONLY evidence screenshots for the 21 Nov 2026 revalidation (every save BLOCKED by probe-lib).
//   12 bugs still broken (red outline) + 9 fixed (green outline) -> screenshots/revalidation/<BUG>-<still|fixed>.png
//   Results also go into reports/Linear/revalidation-21nov.json ("shot", "observed", "contradicts").
// Never presses "Yes, deactivate" or Save-and-keep: popups are always Cancelled, contract / supplier edits are Cancelled.
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const OUT = 'screenshots/revalidation';
const JSON_PATH = 'reports/Linear/revalidation-21nov.json';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const { browser, page } = await open({ log });
const main = page.locator('main');
const results = [];
const RED = '#dc2626', GREEN = '#16a34a';
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();

const mark = async (l, color) => {
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.evaluate((e, c) => { e.style.outline = `3px solid ${c}`; e.style.outlineOffset = '2px'; }, color).catch(() => {});
};
const markAll = async (l, color) => { for (let i = 0; i < await l.count(); i++) await mark(l.nth(i), color); };
const label = (text, color) => page.evaluate(([t, c]) => {
  const d = document.createElement('div'); d.textContent = t;
  Object.assign(d.style, { position: 'fixed', top: '12px', right: '12px', zIndex: 2147483647, background: c, color: '#fff', font: 'bold 16px sans-serif', padding: '6px 12px', borderRadius: '6px' });
  document.body.appendChild(d);
}, [text, color]);

const rows = () => page.locator('tbody tr').filter({ has: page.locator('input[type=checkbox]') });
async function openList(path) {
  await page.goto(path);
  if (/login/.test(page.url())) throw new Error('session expired: ' + page.url());
  await rows().first().or(page.getByText(/no records|yet\./i).first()).waitFor({ timeout: 90000 });
  await page.waitForTimeout(1000);
}
const nameHeader = () => page.locator('thead th:has(input[placeholder="Search name"])').or(page.getByRole('columnheader', { name: /^(Sort by )?Name/ })).first();
const activeHeader = () => page.locator('thead th:has([aria-label="Clear Active filter"])').or(page.getByRole('columnheader', { name: /Active/ })).first();
async function nameSearch(text) {
  const box = page.locator('main thead input[placeholder="Search name"]').first();
  if (!(await box.isVisible().catch(() => false))) {
    await nameHeader().locator('span[aria-hidden=true]').first().click({ force: true });
    await box.waitFor({ state: 'visible', timeout: 10000 });
  }
  await box.fill(text);
  await page.waitForTimeout(2500);
}
async function rowByName(name) {
  await nameSearch(name);
  const r = rows().filter({ has: page.getByText(name, { exact: true }) }).first();
  await r.waitFor({ timeout: 20000 });
  return r;
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;   // e.g. ONLY=BUG-05,BUG-80 re-runs just those
async function item(bug, state, fn) {
  if (ONLY && !ONLY.includes(bug)) return;
  const file = `${OUT}/${bug}-${state}.png`;
  try {
    const { observed, contradicts = false } = await fn(file, state === 'still' ? RED : GREEN);
    results.push({ bug, file, observed, contradicts });
    console.log(`${bug} | ${file} | ${observed}${contradicts ? ' | CONTRADICTS' : ''}`);
  } catch (e) {
    const observed = 'FAILED: ' + clean(e.message).slice(0, 200);
    results.push({ bug, file: 'FAILED', observed, contradicts: false });
    console.log(`${bug} | FAILED | ${observed}`);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

// ---------------- STILL BROKEN ----------------
await item('BUG-112', 'still', async (file, c) => {
  await openList('/producttype');
  await page.getByRole('button', { name: 'Add Product Type', exact: true }).click();
  const dlg = page.getByRole('dialog').filter({ hasText: 'Add Product Type' });
  const name = dlg.getByText(/^Name\s*\*?$/).first().locator('xpath=following::input[1]');
  await name.fill('x'.repeat(150));
  const len = (await name.inputValue()).length;
  await mark(name, c); await label(`length: ${len}`, c);
  await page.screenshot({ path: file });
  await page.keyboard.press('Escape');
  return { observed: `typed 150 "x", Name keeps length: ${len}`, contradicts: len !== 100 };
});

await item('BUG-114', 'still', async (file, c) => {
  await openList('/resources/personnel');
  await nameSearch('zzzqqq');
  const msg = page.getByText(/There are no records in /).first();
  await msg.waitFor({ timeout: 15000 });
  const t = clean(await msg.innerText());
  await mark(msg, c); await page.screenshot({ path: file });
  return { observed: t, contradicts: /Personnel/i.test(t) };
});

for (const [bug, path, name, title] of [['BUG-115', '/currency', 'US Dollar', 'Edit Currency'], ['BUG-17', '/countries', 'India', 'Edit Country']]) {
  await item(bug, 'still', async (file, c) => {
    await openList(path);
    const r = await rowByName(name);
    await r.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(2000);
    const dialogs = await page.getByRole('dialog').filter({ hasText: title }).count();
    await mark(r, c); await page.screenshot({ path: file });
    await page.keyboard.press('Escape');
    return { observed: dialogs ? `clicking "${name}" opened "${title}"` : `clicked "${name}": no "${title}" dialog after 2 s`, contradicts: dialogs > 0 };
  });
}

await item('BUG-13', 'still', async (file, c) => {
  await openList('/airports');
  const add = await page.getByRole('button', { name: /Add Airport/i }).count();
  const bar = page.getByRole('button', { name: 'Columns' }).locator('xpath=..');
  const btns = (await bar.locator('button:visible').allInnerTexts()).map(clean).filter(Boolean);
  await mark(bar, c); await page.screenshot({ path: file });
  return { observed: `toolbar buttons: ${btns.join(', ')}; "Add Airport" buttons: ${add}`, contradicts: add > 0 };
});

await item('BUG-79', 'still', async (file, c) => {
  await page.goto('/suppliers/18/overview');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click({ timeout: 90000 });
  await page.locator('main input[type=file]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto.txt', mimeType: 'text/plain', buffer: Buffer.from('not a document') });
  await page.waitForTimeout(3000);
  const shown = main.getByText('qa-auto.txt').first();
  const ok = await shown.isVisible().catch(() => false);
  const err = clean(await main.getByText(/not allowed|only pdf|file type|unsupported/i).first().innerText({ timeout: 1000 }).catch(() => ''));
  let ctx = '';
  if (ok) { const box = shown.locator('xpath=ancestor::div[2]'); ctx = clean(await box.innerText()); await mark(box, c); }
  await page.screenshot({ path: file });
  await main.getByRole('button', { name: 'Cancel', exact: true }).last().click().catch(() => {});
  if (err) return { observed: `qa-auto.txt REFUSED - slot "${ctx.slice(0, 160)}"; message: ${err}`, contradicts: true };
  return { observed: ok ? `qa-auto.txt shown in the document slot: "${ctx.slice(0, 160)}"${err ? ' / message: ' + err : ''}` : `qa-auto.txt NOT shown${err ? '; message: ' + err : ''}`, contradicts: !ok || !!err };
});

await item('BUG-80', 'still', async (file, c) => {
  await page.goto('/suppliers');
  await page.locator('main tbody tr:visible').first().waitFor({ timeout: 90000 });
  // largest rows-per-page
  const rpp = page.getByRole('combobox', { name: /Rows per page/i }).last();
  let size = 'default';
  if (await rpp.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    await rpp.click(); await page.getByRole('listbox').last().waitFor({ timeout: 5000 });
    const opt = page.getByRole('option').last(); size = clean(await opt.innerText()); await opt.click();
    await page.waitForTimeout(3000);
  }
  const cells = page.locator('main tbody tr:visible td:first-child');
  const texts = await cells.evaluateAll(els => els.map(e => e.textContent ?? ''));
  const bad = [];
  for (let i = 0; i < texts.length; i++) if (texts[i] !== texts[i].trim()) { bad.push(JSON.stringify(texts[i])); await mark(cells.nth(i).locator('xpath=..'), c); }
  if (bad.length) await cells.nth(texts.findIndex(t => t !== t.trim())).scrollIntoViewIfNeeded();
  await label(`${bad.length} names with leading/trailing spaces (rows per page: ${size})`, c);
  await page.screenshot({ path: file });
  return { observed: `${bad.length} of ${texts.length} rows (rows per page ${size}) not trimmed: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ' ...' : ''}`, contradicts: bad.length === 0 };
});

async function openProduct(sub) {
  await page.goto('/suppliers/18/products');
  await page.getByText('Choose a product type').waitFor({ timeout: 90000 });
  await page.getByRole('button', { name: 'Hotel', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Contract', exact: true }).last().waitFor({ timeout: 60000 });
  await page.getByRole('tab', { name: sub, exact: true }).last().click();
  await page.waitForTimeout(3000);
}
const btn = n => page.getByRole('button', { name: n, exact: true }).last();

await item('BUG-97', 'still', async (file, c) => {
  await openProduct('Contract');
  const onHold = main.getByText('On hold', { exact: true }).first();
  const hasHold = await onHold.isVisible().catch(() => false);
  const approved = page.locator('main table:visible').last().locator('tbody tr:visible').filter({ hasText: /Approved/ });
  const n = await approved.count();
  const names = (await approved.locator('td:first-child').allInnerTexts()).map(clean);
  await markAll(approved, c); await mark(onHold, c);
  await onHold.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: file });
  return { observed: `supplier badge "${hasHold ? 'On hold' : 'NOT FOUND'}"; ${n} contract rows "Approved": ${names.join(', ')}`, contradicts: !hasHold || n === 0 };
});

await item('BUG-98', 'still', async (file, c) => {
  await openProduct('Promotions');
  await main.getByRole('button', { name: /Add promotion/i }).last().click();
  const comb = page.getByText('Combinable').first();
  await comb.waitFor({ timeout: 30000 });
  const extra = await main.getByText(/cumulative|combine with|combinable with/i).count();
  const box = comb.locator('xpath=ancestor::div[2]');
  const t = clean(await box.innerText());
  await mark(box, c); await page.screenshot({ path: file });
  await btn('Cancel').click().catch(() => {});
  return { observed: `"${t.slice(0, 150)}"; cumulative / combine-with options found: ${extra}`, contradicts: extra > 0 };
});

async function addContract() {
  await openProduct('Contract');
  await btn('Add contract').click();
  await page.getByPlaceholder('Enter a contract name').waitFor({ timeout: 60000 });
}
async function pick(field, option) {
  await field.click();
  await page.getByRole('listbox').last().waitFor();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).first().click();
}

await item('BUG-99', 'still', async (file, c) => {
  await addContract();
  await pick(page.getByPlaceholder('Choose a base plan'), 'Bed and breakfast');
  await page.waitForTimeout(1000);
  const head = main.getByText('Contract details').first();
  const sec = head.locator('xpath=ancestor::*[.//input[@placeholder="Enter a contract name"]][1]');
  const t = clean(await sec.innerText());
  const tax = /\b(tax|taxes|VAT|GST)\b/i.test(await main.innerText());
  await mark(sec, c); await page.screenshot({ path: file });
  await btn('Cancel').click().catch(() => {});
  return { observed: `Contract details fields: "${t.slice(0, 220)}"; any tax / VAT field on the page: ${tax}`, contradicts: tax };
});

await item('BUG-96', 'still', async (file, c) => {
  await addContract();
  await page.getByPlaceholder('Enter a contract name').fill('QA Auto evidence draft');
  await pick(page.getByPlaceholder('Choose a base plan'), 'Bed and breakfast');
  await pick(page.getByPlaceholder(/Choose a currency|Add a currency on the supplier/).first(), /AED/);
  await btn('Add season').click();
  const d = page.getByRole('dialog').last();
  await d.getByPlaceholder('Enter a season name').fill('QA Season');
  await d.getByRole('button', { name: 'Add season' }).click();
  await d.waitFor({ state: 'hidden', timeout: 10000 });
  const draftText = clean(await main.getByText(/draft/i).first().innerText().catch(() => ''));
  const before = log.length;
  await btn('Save').click();
  await page.waitForTimeout(3000);
  const sent = log.length > before;
  const prob = page.getByText(/problems? to fix/).last();
  let t = clean(await prob.innerText().catch(() => ''));
  if (t) { await prob.click().catch(() => {}); await page.waitForTimeout(1500); }
  const why = clean((await page.locator('.MuiPopover-paper:visible, .MuiPopper-root:visible, [role=tooltip]:visible, .MuiMenu-paper:visible').allInnerTexts()).join(' / '));
  const priceMsg = page.getByText(/price/i).filter({ visible: true }).first();
  if (t) await mark(prob, c); else await mark(priceMsg, c);
  if (why) await mark(page.locator('.MuiPopover-paper:visible, .MuiPopper-root:visible, [role=tooltip]:visible, .MuiMenu-paper:visible').first(), c);
  await page.screenshot({ path: file });
  await page.keyboard.press('Escape');
  await btn('Cancel').click().catch(() => {});
  return { observed: `Save refused: "${t || 'no problems chip'}"${why ? ' -> ' + why.slice(0, 200) : ''}; draft hint on screen: "${draftText.slice(0, 100)}"; save request sent (blocked): ${sent}`, contradicts: sent || !t };
});

await item('BUG-132', 'still', async (file) => {
  fs.copyFileSync('screenshots/bugs/BUG-132-single-early-bird-rounding.png', file);
  return { observed: 'copied 20 Nov capture: single-room early bird 350.98 instead of 351.00 (Marina Bay Hotel, 19-22 Jan 2027)' };
});

// ---------------- FIXED ----------------
for (const [bug, path, entity] of [['BUG-18', '/producttype', 'product type'], ['BUG-19', '/viewtypes', 'view type'], ['BUG-20', '/roomtypes', 'room type'],
  ['BUG-07', '/landmarks', 'landmark'], ['BUG-08', '/airports', 'airport'], ['BUG-40', '/resources/personnel', 'personnel']]) {
  await item(bug, 'fixed', async (file, c) => {
    await openList(path);
    const states = await rows().locator('input[type=checkbox]').evaluateAll(els => els.map(e => e.checked));
    const i = states.indexOf(true);
    if (i < 0) throw new Error(`no ACTIVE row on the first page of ${path}`);
    const rowName = clean(await rows().nth(i).innerText()).slice(0, 60);
    await rows().nth(i).locator('input[type=checkbox]').click();
    const txt = page.locator('.swal2-popup .swal2-html-container');
    await txt.waitFor({ timeout: 15000 });
    const t = clean(await txt.innerText());
    const title = clean(await page.locator('.swal2-popup .swal2-title').innerText().catch(() => ''));
    await mark(txt, c); await page.screenshot({ path: file });
    await page.locator('.swal2-popup').getByRole('button', { name: 'Cancel' }).click();
    await page.locator('.swal2-popup').waitFor({ state: 'hidden', timeout: 10000 });
    const want = `This will mark the ${entity} as inactive.`;
    return { observed: `row "${rowName}": [${title}] ${t}`, contradicts: !t.toLowerCase().includes(want.toLowerCase()) || /deactive/i.test(t + title) };
  });
}

async function activeOptions(path) {
  await openList(path);
  const h = activeHeader();
  if (!(await h.count())) return null;
  const icon = h.locator('span[aria-hidden=true]').first();
  if (await icon.count()) await icon.click({ force: true });
  await page.waitForTimeout(800);
  if (!(await page.getByRole('listbox').isVisible().catch(() => false))) {
    // filter row: other autocompletes first, the Active select is the last div[role=combobox] in thead
    const cb = page.locator('thead div[role=combobox]').last();
    await cb.click({ timeout: 5000 });
  }
  const lb = page.getByRole('listbox').last();
  await lb.waitFor({ timeout: 10000 });
  return { lb, opts: (await lb.getByRole('option').allInnerTexts()).map(clean) };
}
const optCheck = opts => !(opts.join('|') === 'All|Active|Inactive');

await item('BUG-05', 'fixed', async (file, c) => {
  const r = await activeOptions('/provinces');
  if (!r) throw new Error('no Active column on /provinces');
  await mark(r.lb.locator('xpath=..'), c); await page.screenshot({ path: file }); await page.keyboard.press('Escape');
  return { observed: `/provinces Active filter options: ${r.opts.join(' / ')}`, contradicts: optCheck(r.opts) };
});
await item('BUG-38', 'fixed', async (file, c) => {
  let r = await activeOptions('/desk-locations'), note = '/desk-locations';
  if (!r) { note = '/desk-locations has NO Active filter -> used /chartofaccounts'; r = await activeOptions('/chartofaccounts'); }
  if (!r) throw new Error('no Active column on /desk-locations or /chartofaccounts');
  await mark(r.lb.locator('xpath=..'), c); await page.screenshot({ path: file }); await page.keyboard.press('Escape');
  return { observed: `${note}: Active filter options ${r.opts.join(' / ')}`, contradicts: optCheck(r.opts) };
});
await item('BUG-04', 'fixed', async (file, c) => {
  const r = await activeOptions('/currency');
  if (!r) throw new Error('no Active column on /currency');
  await mark(r.lb.locator('xpath=..'), c); await page.screenshot({ path: file }); await page.keyboard.press('Escape');
  return { observed: `/currency Active filter options: ${r.opts.join(' / ')}`, contradicts: optCheck(r.opts) };
});

await browser.close();

// ---------------- report ----------------
const rep = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
for (const r of results) for (const e of rep.filter(x => x.bug === r.bug)) {
  if (r.file !== 'FAILED') { e.shot = r.file; e.exists = true; }
  e.observed = r.observed;
  if (r.contradicts) e.contradicts = true; else delete e.contradicts;
}
fs.writeFileSync(JSON_PATH, JSON.stringify(rep, null, 1) + '\n');
console.log('requests blocked:', log.length ? log.join(' | ') : 'none');
