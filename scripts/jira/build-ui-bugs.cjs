/*
 * Builds the Jira plan for the ERP UI/UX consistency differences (one bug per type of difference, every screen listed)
 * from reports/UI-Consistency/rows.json (scripts/reports/ui-consistency-check.cjs).
 *   node scripts/jira/build-ui-bugs.cjs  ->  reports/Jira/ui-consistency-bugs.json  (then: node scripts/jira/revalidate.mjs <plan>)
 * Screens / points already in an open Jira issue are left out and named under "Already reported".
 */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('reports/UI-Consistency/rows.json', 'utf8')).filter(r => r.result === 'DIFFERENT');
const slug = p => p.replace(/^\//, '').replace(/[^\w]+/g, '-') || 'root';
const shotFor = (screen, kind) => { for (const s of [`screenshots/ui-consistency/${slug(screen)}${kind ? '-' + kind : ''}.png`, `screenshots/ui-consistency/${slug(screen)}.png`]) if (fs.existsSync(s)) return s; return null; };
const ENV = 'Environment: STAGE https://erp.nexgenpilot.com (company sb, Chrome), build of 24 Nov 2026 | found by the ERP UI/UX consistency check (85 screens, every save blocked)';
const STD = 'Standard (product owner, 24 Nov 2026): the Core list screens, e.g. Core > Region > State / Add State';
let nextId = 159;   // BUG-159 onwards (BUG-156..158 raised for the Dashboard)

const groups = [
  { rules: ['S8b Deactivate popup title in Title Case'], exclude: ['/packages'], priority: 'Medium', label: 'ui-text', kind: 'deactivate',
    summary: n => `Deactivate popup titles are not Title Case on ${n} screens ("Deactivate state?" - should be "Deactivate State?")`,
    expected: 'Every dialog / popup title in Title Case: "Deactivate State?", "Deactivate Room Category?" (product owner 24 Nov 2026: Title Case everywhere - replaces the lower-case wording accepted in KAN-26). The popup text stays a sentence: "This will mark the state as inactive."' },
  { rules: ['S1 Title in Title Case'], priority: 'Low', label: 'ui-text',
    summary: n => `Page titles are not Title Case on ${n} Portal CMS screens ("Checkout fields", "Deal cards", "Email templates" ...)`,
    expected: 'Page titles in Title Case like every other screen: "Checkout Fields", "Deal Cards", "Email Templates", "Listing Layout", "Sponsored Offers", "Package Options", "Login Slider".' },
  { rules: ['S10a Add button says', 'S10a Add opens', 'S10b Add opens a dialog titled', 'S2a Toolbar "Add <Screen>"'], exclude: ['/dashboard', '/companies', '/system/data-retention', '/feedback', '/financialperiods', '/agentinvoices', '/supplierinvoices'], priority: 'Low', label: 'ui-consistency', kind: 'add',
    known: { '/enquiries': 'KAN-101', '/packages': 'KAN-100' },
    summary: n => `"New ..." / "Create ..." instead of "Add <Item>" on ${n} screens (button and form title)`,
    expected: 'The toolbar button and the form title both say "Add <Item>" ("Add Journal Voucher", "Add Document", "Add Offer"), and the form opens as a dialog titled "Add <Item>" like Add State.' },
  { rules: ['S10b Form buttons "Cancel" + "Save"'], exclude: ['/financialperiods'], priority: 'Low', label: 'ui-consistency', kind: 'add',
    known: { '/packages': 'KAN-100' },
    summary: n => `Form buttons are not "Cancel" + "Save" on ${n} screens ("Create Agent", "Create Supplier", "Post Journal", "Create & Continue" ...)`,
    expected: 'Every Add / Edit form ends with the same two buttons: "Cancel" and "Save".' },
  { rules: ['S10e Every required (*) field gets its message'], priority: 'Medium', label: 'error-message-consistency', kind: 'add',
    known: { '/journals': 'KAN-137', '/recurringjournals': 'KAN-137', '/portal-cms/documents': 'KAN-112' },
    summary: n => `Empty Save does not mark every required (*) field on ${n} screens (e.g. Add Supplier: 1 message for 5 required fields)`,
    expected: 'An empty Save shows "<Field> is required" under EVERY required (*) field, like Add State ("Name is required", "Country is required").' },
  { rules: ['S10c Empty Save', 'S10d Empty Save', 'S10c Required fields marked'], exclude: ['/financialperiods'], priority: 'Medium', label: 'error-message-consistency', kind: 'add',
    known: { '/portal-cms/deals': 'KAN-111', '/portal-cms/offers': 'KAN-111', '/portal-cms/slider': 'KAN-111', '/portal-cms/storefront': 'KAN-111', '/journals': 'KAN-137', '/recurringjournals': 'KAN-137', '/portal-cms/documents': 'KAN-112', '/packages': 'KAN-120' },
    summary: n => `Empty Save shows a different message or a banner instead of "<Field> is required" on ${n} screens`,
    expected: '"<Field> is required" under each missing field - no banner, no other wording ("Select at least one country", "Rate must be greater than 0", "Write the article before saving"), Save not just disabled, required fields marked *.' },
  { rules: ['S10f Nothing is sent on an empty Save'], exclude: ['/financialperiods'], priority: 'Medium', label: 'validation', kind: 'add',
    known: { '/portal-cms/documents': 'KAN-112' },
    summary: n => `An EMPTY form is sent to the server on ${n} screen(s) - no check in the screen first`,
    expected: 'An empty Save is stopped in the screen ("<Field> is required") and nothing is sent, like Add State. (The test blocked the request, so the screen then said "Pilot can\'t be reached right now.")' },
  { rules: ['S2b Toolbar "Audit History"'], priority: 'Low', label: 'ui-consistency',
    summary: n => `No "Audit History" button on ${n} list screens (Flex 1-10, Journals, Invoices, Feedback ...)`,
    expected: 'Every list has "Audit History" next to "Columns", opening the drawer with All / Created / Updated / Inactive.' },
  { rules: ['S3 Column search'], priority: 'Low', label: 'ui-consistency', known: { '/enquiries': 'KAN-101' },
    summary: n => `No column search (or a wrong placeholder) on ${n} list screens`,
    expected: 'Each column title opens a search box with the placeholder "Search <column>" ("Search name").' },
  { rules: ['S5 Paging'], priority: 'Low', label: 'ui-consistency', known: { '/enquiries': 'KAN-101' },
    summary: n => `No paging ("1-N of N", "Page X of Y") on ${n} list screens`,
    expected: 'Every list shows "1–N of N" and "Page X of Y" (and "Rows per page" when there are more than 10 rows).' },
  { rules: ['S6 Active filter'], priority: 'Low', label: 'ui-consistency', known: { '/enquiries': 'KAN-101' },
    summary: n => `No Active filter, or a different one, on ${n} list screens (Contracts lists "Active / Inactive / All")`,
    expected: 'The Active column filter offers "All", "Active", "Inactive" in this order.' },
  { rules: ['S4a Empty search message', 'S4b Empty search'], priority: 'Low', label: 'ui-text',
    summary: n => `A search with no match shows a different message on ${n} list screens ("No records match these filters.")`,
    expected: 'A search with no match shows "There are no records in <Item>" and "0–0 of 0".' },
  { rules: ['S8a Active switch on each row', 'S7 Clicking a row opens the record'], priority: 'Medium', label: 'ui-consistency', known: { '/agents': 'KAN-113' },
    summary: n => `No Active switch per row (or the row opens nothing) on ${n} list screens (Company, Contracts, Documents)`,
    expected: 'Each row has an Active switch with the "Deactivate <Item>?" popup, and clicking a row opens the record - like the Core lists.' },
  { rules: ['S8c Popup text', 'S8d Popup buttons'], priority: 'Low', label: 'ui-text', kind: 'deactivate',
    summary: n => `The deactivate popup text / buttons differ on ${n} screens (Exchange Rates, Package "Unpublish")`,
    expected: 'Popup text "This will mark the <item> as inactive." and the buttons "Yes, Deactivate" + "Cancel". (Package "Unpublish" may be intended - please confirm.)' },
  { rules: ['S12 Form input', 'S13 Form label', 'S14 Form button heights', 'S15 Add dialog width', 'S16a List row height', 'S16b List header height', 'S16c List text size', 'S17a Toolbar Add button height', 'S17b Audit History button height'], priority: 'Low', label: 'ui-consistency', kind: 'add',
    summary: n => `Sizes differ from the standard on ${n} screens - dialog width, row / header height, button height`,
    expected: 'The same sizes as Add State / the States list: dialog 600 px wide, inputs 40 px, labels 13 px, Save 37 px / Cancel 31 px, list rows 43 px, header 46 px, toolbar Add 37 px, Audit History 31 px. (Wider dialogs for long forms may be intended - please confirm per screen.)' },
];

const plan = [], used = new Set(), report = [];
for (const g of groups) {
  const hit = rows.filter(r => g.rules.some(x => r.rule.startsWith(x)) && !(g.exclude || []).includes(r.screen));
  const byScreen = {};
  for (const r of hit) (byScreen[r.screen] ??= []).push(r);
  const known = g.known || {};
  const fresh = Object.keys(byScreen).filter(s => !known[s]).sort();
  const already = Object.keys(byScreen).filter(s => known[s]).sort();
  hit.forEach(r => used.add(r));
  if (!fresh.length) { report.push(`(only already-reported screens) ${g.summary(0)} -> ${already.map(s => s + ' ' + known[s]).join(', ')}`); continue; }
  const id = `BUG-${nextId++}`;
  const lines = fresh.map(s => `- ${s}: ${byScreen[s].map(r => `${r.rule.replace(/^S\d+\w? /, '')} -> shown "${r.shown}"`).join('; ')}`);
  const shots = [...new Set(fresh.map(s => shotFor(s, g.kind)).filter(Boolean))].slice(0, 3);
  plan.push({ result: 'new', epic: 'KAN-18', labels: ['automation', 'cross-module-common-list-screens', g.label], priority: g.priority,
    summary: `${id}: ${g.summary(fresh.length)}`,
    description: `Module: Cross-module (all ERP screens) | Type: UI/UX consistency | Severity: ${g.priority}\n${STD}.\nExpected: ${g.expected}\nActual - ${fresh.length} screen(s):\n${lines.join('\n')}\n${already.length ? `Already reported (not repeated here): ${already.map(s => `${s} (${known[s]})`).join(', ')}\n` : ''}${ENV} | Bug report ID: ${id}`,
    shots, _screens: fresh, _rule: g.rules[0] });
  report.push(`${id} [${g.priority}] ${fresh.length} screens: ${g.summary(fresh.length)}${already.length ? ` | already reported: ${already.map(s => known[s]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` : ''}`);
}
const left = rows.filter(r => !used.has(r));
fs.writeFileSync('reports/Jira/ui-consistency-bugs.json', JSON.stringify(plan.map(({ _screens, _rule, ...p }) => p), null, 1));
console.log(report.join('\n'));
console.log(`\n${plan.length} bugs, ${rows.length} differences; not assigned to a bug: ${left.length}${left.length ? '\n  ' + left.map(r => `${r.screen} ${r.rule}`).join('\n  ') : ''}`);
