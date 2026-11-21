// Builds the list of ALL raised bugs for Jira (project KAN) - nothing is sent to Jira here.
//   sources: scripts/reports/bug-report.js (BUG-01..134), reports/Linear/ui-text-bugs.json (BUG-136..146),
//            BUG-135 / 147 / 148 / 149 below (raised directly in Linear on 21 Nov 2026)
//   output : reports/Jira/bugs-to-migrate.json  +  reports/Jira/bugs-to-migrate.md (review table)
//   rule   : module = epic (reports/Jira/jira-structure.json), sub-module = label (slug of the component name)
//   Run: node scripts/jira/build-jira-bugs.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const rel = p => path.join(ROOT, p);

// ---------- sources ----------
const src = fs.readFileSync(rel('scripts/reports/bug-report.js'), 'utf8');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('const BUGS = ['), src.indexOf('// bugs confirmed FIXED')).replace('const BUGS', 'this.BUGS'), ctx);
vm.runInContext(src.slice(src.indexOf('const FIXED = {'), src.indexOf('};', src.indexOf('const FIXED = {')) + 2).replace('const FIXED', 'this.FIXED'), ctx);
const bugs = ctx.BUGS.map(b => ({ ...b }));
const FIXED = { ...ctx.FIXED };
const linear = JSON.parse(fs.readFileSync(rel('reports/Linear/linear-map.json'), 'utf8'));

const ui = JSON.parse(fs.readFileSync(rel('reports/Linear/ui-text-bugs.json'), 'utf8'));
const sev = p => ({ 1: 'High', 2: 'High', 3: 'Medium', 4: 'Low' }[p] ?? 'Medium');
for (const u of ui) {
  const rows = (u.buttons ?? []).map(([now, want, where]) => `"${now}" → "${want}" (${where})`)
    .concat((u.pairs ?? []).map(([a, b]) => `${a}  vs  ${b}`));
  bugs.push({ id: u.id, mod: u.module, screen: (u.buttons ?? u.pairs ?? []).map(x => x[2] ?? '').filter(Boolean).slice(0, 3).join(', ') || u.module,
    type: 'UI text', sev: sev(u.priority), title: u.title,
    steps: `Open the screens listed below and read the button / label text.\n${rows.map(r => '- ' + r).join('\n')}`,
    expected: u.expected ?? 'Buttons in Title Case ("Add Currency", "Yes, Deactivate"); the same label written the same way everywhere',
    actual: rows.slice(0, 4).join('; '), tc: 'scripts/reports/ui-text-audit.mjs', shotFile: `screenshots/ui-text/${u.id}.png` });
}
bugs.push(
  { id: 'BUG-135', mod: 'Cross-module (common UI)', screen: 'Deactivate popup (all list screens)', type: 'UI text', sev: 'Low',
    title: 'Deactivate popup button says "Yes, deactivate" (small d) - buttons are Title Case',
    steps: '1. Open any list screen (e.g. Core > Application > Currency)\n2. Switch off an active record\n3. Read the popup button', expected: '"Yes, Deactivate"', actual: '"Yes, deactivate"', tc: 'TC-*-31 (master-ui)' },
  { id: 'BUG-147', mod: 'Core > Resource', screen: 'Menu Core > Resource', type: 'Inconsistency', sev: 'Low',
    title: 'Resource menu items are plural ("Resource Types", "Assets") while "Personnel" and all other menu items are singular',
    steps: '1. Open the menu Core > Resource', expected: '"Resource Type", "Asset" (singular like every other menu item)', actual: '"Resource Types", "Assets"', tc: 'TC-RES-ResourceType-01, TC-RES-Asset-01' },
  { id: 'BUG-148', mod: 'Core > Resource', screen: 'Assets > Add Asset', type: 'Bug', sev: 'High',
    title: 'Asset accepts duplicate names - the same name, other letter case and spaces around are all saved',
    steps: '1. Core > Resource > Assets > Add Asset "QA Auto Asset X"\n2. Add Asset again with the same name / "QA AUTO ASSET X" / "   QA Auto Asset X   "', expected: '"Asset already exists", nothing saved', actual: 'All three duplicates saved (201 Created)', tc: 'TC-ASSET-04/05/06' },
  { id: 'BUG-149', mod: 'Cross-module (common UI)', screen: 'Deactivate switch (State, Product Class, Resource Type)', type: 'Bug', sev: 'High',
    title: 'Deactivate fails silently - server answers 400 "Duplicate value", the screen shows no message and the switch stays ON',
    steps: '1. Two records with the same name exist, one inactive\n2. Switch off the active one > Yes, deactivate', expected: 'Record deactivated - or a clear error message', actual: 'DELETE answers 400 DUPLICATE_KEY; no message, switch stays ON', tc: 'cleanup.spec.ts, TC-*-15' },
);

// ---------- status ----------
const DONE_IN_LINEAR = ['BUG-04', 'BUG-05', 'BUG-07', 'BUG-08', 'BUG-18', 'BUG-19', 'BUG-20', 'BUG-38', 'BUG-40', 'BUG-79'];
for (const id of DONE_IN_LINEAR) FIXED[id] ??= 'Fixed 21-Nov (verified)';
// popups now say "This will mark the <x> as inactive." - TC-RGN-Country/State/City/Market-13 passed in the 21 Nov core rerun
FIXED['BUG-03'] ??= 'Fixed 21-Nov (verified, core rerun: popups say "as inactive")';
const REOPENED = ['BUG-13', 'BUG-17', 'BUG-80', 'BUG-96', 'BUG-97', 'BUG-98', 'BUG-99', 'BUG-112', 'BUG-114', 'BUG-115', 'BUG-132'];
const DUPLICATE = { 'BUG-101': 'BUG-50' };   // Linear SAH-122 was closed as duplicate of SAH-112 (= BUG-101 / BUG-50)

// ---------- module -> epic, sub-module -> label ----------
const cfg = JSON.parse(fs.readFileSync(rel('reports/Jira/jira-structure.json'), 'utf8'));
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const EPIC = Object.fromEntries(Object.entries(cfg.epics).map(([n, e]) => [n, e.key]));
const C = (epic, comp) => ({ epic, epicKey: EPIC[epic], component: comp, label: slug(comp) });
const CROSS_LIST = C('Cross-module', 'Cross-module – Common List Screens');
const CROSS_TEXT = C('Cross-module', 'Cross-module – UI Text');
const OVERRIDE = {
  'BUG-50': C('Contracts', 'Contracts – List'), 'BUG-66': C('Supplier', 'Supplier – Excursions'), 'BUG-132': C('Reservation', 'Reservation – Product Search'),
  'BUG-107': C('Reservation', 'Reservation – Booking'), 'BUG-109': C('Reservation', 'Reservation – Booking'), 'BUG-130': C('Reservation', 'Reservation – Booking'),
  'BUG-131': C('Reservation', 'Reservation – Money & Cancellation'), 'BUG-111': C('Insights', 'Insights – Dashboard'), 'BUG-94': C('Portal CMS', 'Portal CMS – Emails & Documents'),
  'BUG-93': C('Portal CMS', 'Portal CMS – Storefront & Content'), 'BUG-31': C('Core', 'Core – Application'),
  'BUG-135': CROSS_TEXT, 'BUG-136': CROSS_TEXT, 'BUG-137': CROSS_TEXT, 'BUG-146': CROSS_TEXT, 'BUG-149': CROSS_LIST,
  'BUG-138': C('Supplier', 'Supplier – Financials'), 'BUG-139': C('Supplier', 'Supplier – List & Overview'), 'BUG-140': C('Agent (B2B)', 'Agent – List & Overview'),
  'BUG-141': C('Insights', 'Insights – Dashboard'), 'BUG-142': C('Reservation', 'Reservation – Booking'), 'BUG-143': C('CRM', 'CRM – Enquiries'),
  'BUG-144': C('Portal CMS', 'Portal CMS – Storefront & Content'), 'BUG-145': C('Accounts', 'Accounts – Journals'),
};
function place(b) {
  if (OVERRIDE[b.id]) return OVERRIDE[b.id];
  const m = b.mod, s = `${b.screen} ${b.title}`;
  const multi = /\//.test(m) || /\(.*\/.*\)/.test(m) || /^All |list screens|all switch screens|All Add\/Edit/i.test(b.screen) || /^Core$/.test(m);
  if (multi && !/^Core > Accounts|^Supplier - /.test(m)) return CROSS_LIST;
  if (/^Login/.test(m)) return C('Login & Access', 'Login – Session');
  if (/^Company/.test(m)) return C('Company', 'Company – Profile');
  if (/Accounts/.test(m)) {
    if (/journal/i.test(s)) return C('Accounts', 'Accounts – Journals');
    if (/invoice/i.test(s)) return C('Accounts', 'Accounts – Invoices');
    if (/period|bank|close year/i.test(s)) return C('Accounts', 'Accounts – Periods & Bank');
    return C('Accounts', 'Accounts – Configuration');
  }
  if (/System|Restriction|User/.test(m) || /^(User|Restriction Group|Refund Payouts)/.test(b.screen)) {
    if (/User|Restriction/i.test(s)) return C('System', 'System – Users & Access');
    if (/help/i.test(s)) return C('System', 'System – Help');
    return C('System', 'System – Settings');
  }
  if (/^Core > Region/.test(m)) return C('Core', 'Core – Region');
  if (/^Core > Product/.test(m)) return C('Core', 'Core – Product');
  if (/^Core > Organization/.test(m)) return C('Core', 'Core – Organization');
  if (/^Core > Resource/.test(m)) return C('Core', 'Core – Resource');
  if (/^Core > Application/.test(m)) return C('Core', 'Core – Application');
  if (/^Supplier/.test(m)) {
    if (/Contracts list \(menu Contracts\)/.test(b.screen)) return C('Contracts', 'Contracts – List');
    if (/^Supplier - (Contract|Promotion|Allotment)/.test(m) || /contract|promotion|allotment|cancellation|rates|season/i.test(b.screen)) return C('Supplier', 'Supplier – Contracts & Rates');
    if (/Contacts/.test(b.screen)) return C('Supplier', 'Supplier – Contacts');
    if (/Financials|bank|currency/i.test(b.screen)) return C('Supplier', 'Supplier – Financials');
    if (/room|Products/i.test(b.screen)) return C('Supplier', 'Supplier – Hotel Products');
    return C('Supplier', 'Supplier – List & Overview');
  }
  if (/^Agent/.test(m)) {
    if (/Financials|currency|top-up|credit|wallet/i.test(s)) return C('Agent (B2B)', 'Agent – Financials & Credit');
    if (/access/i.test(s)) return C('Agent (B2B)', 'Agent – Product Access');
    return C('Agent (B2B)', 'Agent – List & Overview');
  }
  if (/^Contracts/.test(m)) return C('Contracts', 'Contracts – List');
  if (/^Package/.test(m)) return C('Package', /publish/i.test(s) ? 'Package – Publishing' : 'Package – Builder');
  if (/^Enquir/.test(m)) return C('CRM', 'CRM – Enquiries');
  if (/^Reservation/.test(m)) return C('Reservation', 'Reservation – Booking');
  if (/^Dashboard/.test(m)) return C('Insights', 'Insights – Dashboard');
  if (/^Portal CMS/.test(m)) return C('Portal CMS', 'Portal CMS – Storefront & Content');
  return CROSS_LIST;
}

// ---------- screenshots ----------
const bugShots = fs.readdirSync(rel('screenshots/bugs')).filter(f => f.endsWith('.png'));
const revShots = fs.readdirSync(rel('screenshots/revalidation'));
const fixedShots = fs.existsSync(rel('screenshots/fixed')) ? fs.readdirSync(rel('screenshots/fixed')) : [];
function shotsFor(b) {
  const out = bugShots.filter(f => f.startsWith(b.id + '-')).map(f => `screenshots/bugs/${f}`);
  if (b.shotFile && fs.existsSync(rel(b.shotFile))) out.push(b.shotFile);
  out.push(...revShots.filter(f => f.startsWith(b.id + '-') && !/-fixed\.png$|-still\.png$/.test(f)).map(f => `screenshots/revalidation/${f}`));
  return [...new Set(out)];
}
function fixShotsFor(id) {
  return [...revShots.filter(f => f === `${id}-fixed.png` || f === `${id}b-fixed.png`).map(f => `screenshots/revalidation/${f}`),
    ...fixedShots.filter(f => f.startsWith(id + '-')).map(f => `screenshots/fixed/${f}`)];
}

// ---------- assemble ----------
const ENV = 'STAGE https://erp.nexgenpilot.com (company "sb", Chrome)';
const out = bugs.sort((a, b) => +a.id.slice(4) - +b.id.slice(4)).map(b => {
  const p = place(b);
  const status = DUPLICATE[b.id] ? 'Complete' : FIXED[b.id] ? 'Complete' : REOPENED.includes(b.id) ? 'Reopened' : 'To Do';
  const kind = slug(b.type || 'bug');
  const labels = [...new Set(['automation', p.label, kind, ...(DUPLICATE[b.id] ? ['duplicate'] : []), ...(REOPENED.includes(b.id) ? ['reopened'] : [])])];
  const lin = linear[b.id]?.issue;
  const desc = [
    `**Module:** ${b.mod}  |  **Screen:** ${b.screen}  |  **Type:** ${b.type}  |  **Severity:** ${b.sev}`,
    '', '### Steps to reproduce', b.steps || '-',
    '', '### Actual result', b.actual || '-',
    '', '### Expected result', b.expected || '-',
    '', `**Environment:** ${ENV}  |  **Automated test:** ${b.tc || '-'}  |  **Bug report ID:** ${b.id}${lin ? `  |  previously Linear ${lin}` : ''}`,
    ...(DUPLICATE[b.id] ? ['', `**Duplicate of ${DUPLICATE[b.id]}** (closed as duplicate).`] : []),
    ...(FIXED[b.id] && !DUPLICATE[b.id] ? ['', `✅ **${FIXED[b.id]}** on the stage build of 21 Nov 2026 - fix screenshot attached.`] : []),
    ...(REOPENED.includes(b.id) ? ['', '🔁 **Reopened 21 Nov 2026** - reported as fixed but still reproduced on the stage build of 21 Nov 2026.'] : []),
  ].join('\n');
  return { id: b.id, summary: `${b.id}: ${b.title}`.slice(0, 250), epic: p.epic, epicKey: p.epicKey, component: p.component, label: p.label,
    labels, priority: b.sev === 'Critical' ? 'Highest' : (b.sev || 'Medium'), status, linear: lin ?? null, duplicateOf: DUPLICATE[b.id] ?? null,
    screenshots: shotsFor(b), fixScreenshots: FIXED[b.id] ? fixShotsFor(b.id) : [], description: desc };
});

fs.mkdirSync(rel('reports/Jira'), { recursive: true });
fs.writeFileSync(rel('reports/Jira/bugs-to-migrate.json'), JSON.stringify(out, null, 1));
const byEpic = {};
for (const b of out) (byEpic[b.epic] ??= []).push(b);
const md = ['# Bugs to move to Jira (project KAN) - review', '', `${out.length} bugs · ${out.filter(b => b.status === 'Complete').length} Complete · ${out.filter(b => b.status === 'Reopened').length} Reopened · ${out.filter(b => b.status === 'To Do').length} To Do · type Bug · assignee Sahil Chauhan`, ''];
for (const [epic, list] of Object.entries(byEpic).sort((a, b) => a[1][0].epicKey.localeCompare(b[1][0].epicKey, undefined, { numeric: true }))) {
  md.push(`## ${epic} (${list[0].epicKey}) - ${list.length}`, '', '| Bug | Sub-module label | Priority | Status | Shots | Title |', '|---|---|---|---|---|---|');
  for (const b of list) md.push(`| ${b.id} | ${b.label} | ${b.priority} | ${b.status} | ${b.screenshots.length}${b.fixScreenshots.length ? '+' + b.fixScreenshots.length + ' fix' : ''} | ${b.summary.replace(/^BUG-\d+: /, '').replace(/\|/g, '/').slice(0, 90)} |`);
  md.push('');
}
fs.writeFileSync(rel('reports/Jira/bugs-to-migrate.md'), md.join('\n'));
console.log(md[2]);
for (const [epic, list] of Object.entries(byEpic)) console.log(`${epic.padEnd(16)} ${String(list.length).padStart(3)}  ${[...new Set(list.map(b => b.label))].join(', ')}`);
console.log('no screenshot:', out.filter(b => !b.screenshots.length).map(b => b.id).join(' '));
