// UI TEXT AUDIT (READ-ONLY - every save is blocked, popups are always closed with Cancel / Escape).
// Visits every known screen, opens its "Add ..." form and its deactivate popup, and records the visible text:
// buttons, headings, tabs, column headers, field labels, placeholders, popup title / message / buttons, empty messages.
// Then flags: capitalisation that differs from how the rest of the app writes the same kind of text, the same phrase
// written in different ways, known wrong words, double spaces, missing / extra end punctuation, and "a" before a vowel.
//   node scripts/ui-text-audit.mjs            -> reports/UI-Text-Audit/ui-text-audit.json + .md
import { open } from './probe-lib.mjs';
import fs from 'fs';

const SCREENS = `/dashboard /product-search /suppliers /suppliers/10/overview /suppliers/10/contacts /suppliers/10/financials /agents /agents/2/overview /agents/2/financials /agents/2/access
/contracts /packages /packages/new /quotes /quotes/1 /quotes/new /reservations /reservations/3 /reservations/new /enquiries /amendments /feedback /reports /playground /companies /companies/2
/portal-cms/overview /portal-cms/storefront /portal-cms/listing /portal-cms/packages /portal-cms/offers /portal-cms/deals /portal-cms/slider /portal-cms/documents /portal-cms/emails /portal-cms/checkout /portal-cms/scheduler
/currency /contacttype /languages /themes /feedback-questions /status /countries /states /cities /markets /desk-locations /landmarks /provinces /airports
/producttype /productclass /roomtypes /roomcategories /viewtypes /amenities /supplements /allotments /addons /excursion-setup
/organization/branches /organization/departments /restrictions /users /resourcetypes /resources/personnel /resources/assets /resourcemapping
/chartofaccounts /accountgroup /tax /taxdetail /exchangetypes /exchangerates /journals /recurringjournals /financialperiods /agentinvoices /supplierinvoices /bankreconciliation /accountingsettings
/flex/1 /system/configurations /system/data-retention /system/help`.split(/\s+/).filter(Boolean);

const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(15000);
const items = [];      // { screen, where, kind, text }
const add = (screen, where, kind, list) => { for (const t of list) { const s = t.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim(); if (s && s.length < 160) items.push({ screen, where, kind, text: s }); } };

const collect = async (screen, where, scope) => {
  const root = page.locator(scope).last();
  if (!(await root.count())) return;
  const grab = (sel) => root.locator(sel).evaluateAll(es => es.filter(e => e.offsetParent !== null || e.getClientRects().length).map(e => (e.innerText ?? e.textContent ?? '').trim()));
  add(screen, where, 'button', await grab('button, [role=button]').catch(() => []));
  add(screen, where, 'heading', await grab('h1, h2, h3, h4, h5, h6').catch(() => []));
  add(screen, where, 'tab', await grab('[role=tab]').catch(() => []));
  add(screen, where, 'column', await grab('thead th').catch(() => []));
  add(screen, where, 'label', await grab('label, .MuiFormLabel-root').catch(() => []));
  add(screen, where, 'placeholder', await root.locator('input[placeholder]:visible, textarea[placeholder]:visible').evaluateAll(es => es.map(e => e.placeholder)).catch(() => []));
  add(screen, where, 'message', await grab('.MuiFormHelperText-root, .MuiAlert-message, [role=alert], .swal2-html-container').catch(() => []));
  add(screen, where, 'empty', await root.getByText(/^There are no records|^No .* yet|^No records/).allInnerTexts().catch(() => []));
};

for (const s of SCREENS) {
  try {
    await page.goto(s);
    await page.locator('main').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await collect(s, 'page', 'main');
    // the "Add ..." form (dialog or full page) - only opened, never saved
    const addBtn = page.locator('main').getByRole('button', { name: /^(\+\s*)?(Add|New|Create) / }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click().catch(() => {});
      await page.waitForTimeout(2500);
      const dlg = page.locator('.MuiDialog-paper:visible');
      await collect(s, 'add-form', (await dlg.count()) ? '.MuiDialog-paper:visible' : 'main');
      // empty save -> required-field messages (blocked anyway)
      const save = (await dlg.count() ? dlg.last() : page.locator('main')).getByRole('button', { name: /^(Save|Create|Add)( |$)/ }).last();
      if (await save.isVisible().catch(() => false)) { await save.click().catch(() => {}); await page.waitForTimeout(1500); await collect(s, 'add-form-empty-save', (await dlg.count()) ? '.MuiDialog-paper:visible' : 'main'); }
      await page.keyboard.press('Escape').catch(() => {});
      const cancel = page.getByRole('button', { name: 'Cancel', exact: true }).last();
      if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    // the deactivate popup of the first ACTIVE row - opened and cancelled
    await page.goto(s); await page.waitForTimeout(3000);
    const sw = page.locator('main tbody tr:visible input[role=switch]:checked, main tbody tr:visible input[type=checkbox]:checked').first();
    if (await sw.count()) {
      await sw.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
      if (await page.locator('.swal2-popup:visible').count()) {
        await collect(s, 'deactivate-popup', '.swal2-popup:visible');
        add(s, 'deactivate-popup', 'popup-title', await page.locator('.swal2-title:visible').allInnerTexts());
        await page.locator('.swal2-popup:visible').getByRole('button', { name: /cancel/i }).click().catch(() => page.keyboard.press('Escape'));
        await page.waitForTimeout(800);
      }
    }
    console.log('ok ' + s + ' (' + items.filter(i => i.screen === s).length + ' texts)');
  } catch (e) { console.log('skip ' + s + ': ' + String(e).slice(0, 120)); }
}
await browser.close();
if (log.length) console.log('BLOCKED WRITES (expected, nothing saved): ' + log.length);

// ---------------- analysis ----------------
const minor = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'with', 'via', 'is', 'are', 'be', 'it', 'its', 'not', 'no']);
const words = t => t.split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
const style = t => {                       // Title / Sentence / lower / UPPER / single
  const w = words(t).filter(x => !/^[A-Z0-9-]{2,}$/.test(x) || x.length > 6);      // ignore codes like AED, B2B
  if (w.length < 2) return 'single';
  if (t === t.toUpperCase()) return 'UPPER';
  const rest = w.slice(1).filter(x => !minor.has(x.toLowerCase()));
  if (!rest.length) return /^[A-Z]/.test(w[0]) ? 'single' : 'lower';
  if (rest.every(x => /^[A-Z]/.test(x))) return 'Title';
  if (rest.every(x => /^[a-z]/.test(x))) return /^[A-Z]/.test(w[0]) ? 'Sentence' : 'lower';
  return 'Mixed';
};
const uniq = new Map();                    // kind|text -> { kind, text, style, screens:Set }
for (const i of items) {
  const k = i.kind + '|' + i.text;
  if (!uniq.has(k)) uniq.set(k, { kind: i.kind, text: i.text, style: style(i.text), screens: new Set() });
  uniq.get(k).screens.add(i.screen + (i.where === 'page' ? '' : ' (' + i.where + ')'));
}
const all = [...uniq.values()];
const findings = [];
const push = (type, f) => findings.push({ type, ...f, screens: [...f.screens].slice(0, 8), count: f.screens.size });
// 1. majority style per kind -> outliers
for (const kind of ['button', 'heading', 'tab', 'column', 'label', 'popup-title']) {
  const multi = all.filter(x => x.kind === kind && ['Title', 'Sentence', 'Mixed', 'lower'].includes(x.style));
  const tally = {}; for (const x of multi) tally[x.style] = (tally[x.style] ?? 0) + x.screens.size;
  // the user's standard (21 Nov 2026): BUTTONS are Title Case; other kinds follow what most of the app does
  const major = kind === 'button' ? 'Title' : Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const why = kind === 'button' ? 'buttons must be Title Case (agreed standard)' : `most of the app uses ${major} case`;
  for (const x of multi) if (major && x.style !== major) push(`capitals (${kind}: ${why})`, { text: x.text, style: x.style, screens: x.screens });
  findings.push({ type: `info: ${kind} capitalisation tally`, text: JSON.stringify(tally), screens: [], count: 0 });
}
// 2. same phrase written differently (case / spacing / plural)
const norm = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const byNorm = new Map();
for (const x of all) { const n = norm(x.text); if (n.length < 3) continue; (byNorm.get(n) ?? byNorm.set(n, []).get(n)).push(x); }
for (const [, xs] of byNorm) { const variants = [...new Set(xs.map(x => x.text))]; if (variants.length > 1) push('same text written in different ways', { text: variants.join('  |  '), screens: new Set(xs.flatMap(x => [...x.screens])) }); }
// 3. wording problems
const rules = [
  [/\bdeactive\b/i, 'not an English word (use "inactive")'], [/\ba [aeiou]\w+/i, '"a" before a vowel (use "an")'], [/ {2,}/, 'double space'],
  [/\b(\w+) \1\b/i, 'repeated word'], [/\bteh\b|\brecieve|\bseperat|\boccured|\badress\b|\bsucess|\bcancell?ation?s?\b(?<!cancellation)/i, 'spelling'],
  [/\.\.$|\s[.,!?]$/, 'stray punctuation'], [/^[a-z]/, 'starts with a small letter'],
];
for (const x of all) for (const [re, why] of rules) if (re.test(x.text) && !(why === 'starts with a small letter' && ['placeholder', 'empty'].includes(x.kind))) push('wording: ' + why, { text: `[${x.kind}] ${x.text}`, screens: x.screens });
// 4. messages / empty texts: full stop or not
const msgs = all.filter(x => ['message', 'empty'].includes(x.kind) && x.text.split(' ').length > 2);
const withDot = msgs.filter(x => /[.!?]$/.test(x.text)), noDot = msgs.filter(x => !/[.!?]$/.test(x.text));
if (withDot.length && noDot.length) for (const x of (withDot.length >= noDot.length ? noDot : withDot)) push(`end punctuation (most messages ${withDot.length >= noDot.length ? 'end with' : 'have no'} a full stop)`, { text: x.text, screens: x.screens });

fs.mkdirSync('reports/UI-Text-Audit', { recursive: true });
fs.writeFileSync('reports/UI-Text-Audit/ui-text-audit.json', JSON.stringify({ when: new Date().toISOString(), screens: SCREENS.length, texts: items.length, unique: all.length, findings }, null, 1));
const md = ['# UI text audit', '', `Stage, ${new Date().toISOString().slice(0, 16)} UTC - ${SCREENS.length} screens, ${all.length} unique texts, ${findings.filter(f => !f.type.startsWith('info')).length} findings`, ''];
const groups = {}; for (const f of findings) (groups[f.type] ??= []).push(f);
for (const [t, fs2] of Object.entries(groups)) { md.push(`## ${t} (${fs2.length})`, ''); for (const f of fs2.slice(0, 80)) md.push(`- **${f.text}**${f.count ? ` — ${f.count} place(s): ${f.screens.join(', ')}` : ''}`); md.push(''); }
fs.writeFileSync('reports/UI-Text-Audit/ui-text-audit.md', md.join('\n'));
console.log(`DONE: ${all.length} unique texts, ${findings.filter(f => !f.type.startsWith('info')).length} findings -> reports/UI-Text-Audit/`);
