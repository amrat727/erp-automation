// Builds reports/Jira/revalidation-24nov.json - the result of validating the issues Sahil assigned (24 Nov 2026 stage build).
// Screenshots are copied to screenshots/revalidation-24nov/<KEY>-n.png so the plan does not depend on test-results folders.
//   node scripts/jira/build-plan-24nov.cjs && node scripts/jira/revalidate.mjs reports/Jira/revalidation-24nov.json
const fs = require('fs'), path = require('path');
const OUT = 'screenshots/revalidation-24nov'; fs.mkdirSync(OUT, { recursive: true });
const T = 'test-results-sahil3-';
const V = 'Verified FIXED on the stage build of 24 Nov 2026';
const R = 'Retested on the stage build of 24 Nov 2026 - STILL BROKEN';
const glob = (dir, part, file = 'test-failed-1.png') => {
  if (!fs.existsSync(dir)) return null;
  const d = fs.readdirSync(dir).find(x => x.includes(part));
  return d ? path.join(dir, d, file) : null;
};
const items = [
  // ---------------- fixed ----------------
  ['KAN-19', 'fixed', `${V}: spaces around Company code / Username are trimmed - signing in with them now succeeds.`, [glob(T + 'evidence', 'not-trimmed')]],
  ['KAN-22', 'fixed', `${V}: a signed-in user who opens /login no longer sees the login form.`, [glob(T + 'evidence', 'login-sees-the-login-form')]],
  ['KAN-45', 'fixed', `${V}: a search with spaces before / after the text finds the records.`, [glob(T + 'evidence', 'finds-nothing')]],
  ['KAN-46', 'fixed', `${V}: switching an inactive record back on asks "Activate state? This will mark the state as active." (Yes, Activate / Cancel). Checked with saves blocked, then cancelled.`, ['screenshots/sahil/KAN-46-reactivate-popup.png']],
  ['KAN-47', 'fixed', `${V}: form labels are linked to their inputs (Add State: Name and Country found by label, 0 unlinked inputs).`, ['screenshots/sahil/KAN-47-add-state-labels.png']],
  ['KAN-61', 'fixed', `${V}: a second supplier with the same name is refused - only one "QA Auto Supplier QA1939 evidence" exists (left Blocked).`, [glob(T + 'bug43', 'same-name')]],
  ['KAN-64', 'fixed', `${V}: a 3-character SWIFT code ("ABC") is refused (8 or 11 characters). Automated test TC-SUP-54.`, [glob(T + 'suprt', 'ABC-rejected')]],
  ['KAN-72', 'fixed', `${V}: a second contract for the same dates with the same priority is refused (the Priority help says it must not be one another contract has). Automated test TC-RULE-11.`, []],
  ['KAN-78', 'fixed', `${V}: a supplier contact without an email is not accepted. (A QA Contact Type was created for the check and deactivated afterwards.) Automated test TC-R2-05.`, [glob(T + 'kan78', 'email-is-mandatory')]],
  ['KAN-81', 'fixed', `${V}: a new contract shows no "add an allotment first / on request" warning. Automated test TC-R2-11.`, []],
  ['KAN-83', 'fixed', `${V}: a second contract with the same name is not accepted. Automated test TC-R2-23.`, [glob(T + 'suprt2', 'SAME-NAME-is-NOT-accepted')]],
  ['KAN-85', 'fixed', `${V}: a promotion discount above 99 % (100 %) is not accepted. Automated test TC-R2-31.`, []],
  ['KAN-87', 'fixed', `${V}: a credit limit of -500 on Add Agent shows "Credit limit can't be negative" and nothing is sent. Automated test TC-AGF-06.`, [glob(T + 'agentfix', 'limit--500', 'credit-limit-minus-500.png')]],
  ['KAN-88', 'fixed', `${V}: an Approved agent offers Approved / Blocked only - it can no longer go back to On hold. Automated test TC-AR-01.`, [glob(T + 'agent-b', 'Approved-Blocked-only')]],
  ['KAN-89', 'fixed', `${V}: the new Add Agent form has no General / Concierge / Desk client type; Sales channel is B2B.`, [glob(T + 'agent', 'b555a')]],
  ['KAN-90', 'fixed', `${V}: an address phone "abc!!" is refused. Automated test TC-AR-03.`, [glob(T + 'agent-b', 'phone-number-abc')]],
  ['KAN-91', 'fixed', `${V}: the Agent list has a search box in the Code column.`, [glob(T + 'agent-c', 'filtered-by-Code')]],
  ['KAN-92', 'fixed', `${V}: Add Agent has a required "Account manager*" field.`, [glob(T + 'agent', 'b555a')]],
  ['KAN-93', 'fixed', `${V}: agent currency payment days of 366 are not accepted (0-365). Automated test TC-AR-06.`, [glob(T + 'agent-c', 'above-365')]],
  ['KAN-94', 'fixed', `${V}: an agent currency can no longer be removed - there is no "Remove currency" any more (only the Active switch).`, [glob(T + 'agent-c', 'currency-can-NOT-be-removed')]],
  ['KAN-95', 'fixed', `${V}: a second agent with the same name (different email) is created ("Agent created successfully"). The QA agents were set to Blocked afterwards.`, [glob(T + 'agentfix', 'different-email-IS-allowed')]],
  ['KAN-98', 'fixed', `${V}: supplier names are saved without spaces before / after. Automated test TC-SUP-14.`, [glob(T + 'suprt', 'paces-before-after')]],
  ['KAN-99', 'fixed', `${V}: the Supplier list button says "Add Supplier".`, [glob(T + 'consistency', 'Add-Supplier')]],
  ['KAN-102', 'fixed', `${V}: the Contracts list has "Add Contract", "Audit History", "Columns" and column searches ("Search contract", "Search" open when the column title is clicked).`, [glob(T + 'consistency', 'f524e'), 'screenshots/sahil/KAN-102-contracts-column-search.png']],
  ['KAN-103', 'fixed', `${V}: the Agent and Package lists have "Audit History" and "Columns".`, [glob(T + 'consistency', 'bb6a3'), glob(T + 'consistency', '33662')]],
  ['KAN-104', 'fixed', `${V}: the Company list has a column search, the standard empty message and paging.`, [glob(T + 'cons2', '1faf5'), glob(T + 'consistency', 'a963d')]],
  ['KAN-105', 'fixed', `${V}: the Supplier and Agent status filters use the same words: All / Approved / On hold / Blocked.`, []],
  ['KAN-106', 'fixed', `${V}: every Active filter (Core, Supplier, Package, Quotes, Reservation) offers the same words: All / Active / Inactive.`, []],
  ['KAN-107', 'fixed', `${V}: Add Quote and Add Reservation show the errors under the fields only - no extra "Please fix the highlighted fields." popup.`, [glob(T + 'cons2', '62895'), glob(T + 'cons2', '1b653')]],
  ['KAN-108', 'fixed', `${V}: mandatory-field messages follow "<Field> is required" (Reservation Travel Dates, Portal CMS checkout field Label).`, [glob(T + 'cons2', 'ae33e'), glob(T + 'cons2', '97106')]],
  ['KAN-109', 'fixed', `${V}: Add room shows "<Field> is required" under Room name and View - no numbered banner.`, [glob(T + 'cons3', 'a271b')]],
  ['KAN-110', 'fixed', `${V}: Agent "Add Currency" and "Add Top-up" mark the field with "<Field> is required" (no banner only).`, [glob(T + 'cons2', 'a1fd6'), glob(T + 'cons2', '7fb14')]],
  ['KAN-115', 'fixed', `${V}: approving a contract of an On hold supplier is refused - "This supplier is On hold. Approve the supplier before approving its contracts or promotions." (400). Note: the 13 contracts approved earlier on "Testing season 3" are still Approved (data from before the fix).`, ['screenshots/sahil/KAN-115-approve-on-hold-supplier.png']],
  ['KAN-119', 'fixed', `${V}: clicking a contract opens THAT contract. Automated test TC-CTM-15.`, [glob(T + 'modules', 'THAT-contract')]],
  ['KAN-123', 'fixed', `${V}: Add Quote and Add Reservation do not offer Blocked agents (typing "QA Auto Agent" finds none; "Gulf" finds Gulf Horizons Travel LLC).`, ['screenshots/sahil-KAN-123-quote-agent-list.png', 'screenshots/sahil-KAN-123-reservation-agent-list.png']],
  ['KAN-124', 'fixed', `${V}: Quote and Reservation history no longer show internal numbers like "-9223372036854774807". (Raw JSON in Reservation history is a different bug, KAN-125.)`, [glob(T + 'modules', '9223372036854774807'), glob(T + 'res28', 'raw-JSON', 'reservation-history.png')]],
  ['KAN-129', 'fixed', `${V}: names keep digits and & ( ) and are trimmed (Role "Zone 2 North-1 & Co (Test)", Exchange Type).`, [glob(T + 'evidence', 'Name-removes-digits'), glob(T + 'xt', 'Exchange-Type')]],
  ['KAN-132', 'fixed', `${V}: deactivating a record that is in use shows an "in use" warning (Driver, Delhi Branch, Reservations, US Dollar, Default Exchange).`, [glob(T + 'core', 'INUSE'), glob(T + 'evidence', 'in-use-warning')]],
  ['KAN-150', 'fixed', `${V}: the deactivate popup button says "Yes, Deactivate". Automated tests TC-*-31.`, []],
  ['KAN-151', 'fixed', `${V}: the shared buttons are Title Case ("Audit History", ...) - none of the old lower-case labels found.`, ['screenshots/ui-text/BUG-136.png']],
  ['KAN-152', 'fixed', `${V}: one spelling everywhere - "Add Agent", "Credit Requests", "Add Currency", "Exchange Type", "Amendment Requests", "Applies To", "Name is required" (no full stop), "All (0)".`, ['screenshots/sahil/KAN-152-add-status.png', 'screenshots/sahil/KAN-152-resource-type-required.png']],
  ['KAN-153', 'fixed', `${V}: no "Phone#", "PAN#", "TAN#" labels any more.`, ['screenshots/ui-text/BUG-138.png']],
  ['KAN-154', 'fixed', `${V}: Supplier buttons are Title Case ("Add Supplier", "Create Supplier", "Add Contact").`, ['screenshots/ui-text/BUG-139.png']],
  ['KAN-155', 'fixed', `${V}: Agent buttons are Title Case ("Create Agent", "Edit Agent", "Add Currency", "Add Top-up").`, ['screenshots/ui-text/BUG-140.png']],
  ['KAN-161', 'fixed', `${V}: Core / System buttons are Title Case - none of the old labels found.`, ['screenshots/ui-text/BUG-146.png']],
  ['KAN-164', 'fixed', `${V}: deactivating the records that used to fail silently ("QA Auto State QKVRQT edited", Product Class / Resource Type "... PTKLLV edited") now works - the cleanup deactivated them with no refusal.`, []],
  // ---------------- still broken -> Reopened + back to Sahil ----------------
  ['KAN-113', 'reopen', `${R} (partly): the Supplier list now has an Active switch, but the Agent list still has none - an agent can only be "deactivated" by setting Status = Blocked in Edit Agent.`, [glob(T + 'reopen', 'switch-per-row', 'test-finished-1.png'), glob(T + 'consistency', '958b5')]],
  ['KAN-116', 'reopen', `${R}: a promotion still has only a "Combinable" switch - no choice of WHICH promotions it combines with, no cumulative / non-cumulative option. Automated test TC-R3-04.`, [glob(T + 'reopen', 'cumulative-or-not', 'test-finished-1.png')]],
  ['KAN-127', 'reopen', `${R}: Dashboard "Approved agents 9 of 41 active · 8 on hold" - the 41 "active" includes the Blocked agents. Automated test TC-DSH-05.`, [glob(T + 'reopen', 'Blocked-agents-active', 'test-finished-1.png')]],
  ['KAN-130', 'reopen', `${R} (partly): Role, Theme, Personnel and Asset are fixed, but an empty search on Account (Accounts > Configuration) still does not say "There are no records in Account". Automated test TC-ACC-Account-06.`, [glob(T + 'reopen', 'records-in-Account', 'test-finished-1.png')]],
  ['KAN-148', 'reopen', `${R}: 1 adult, Deluxe Single, 3 nights Peak: sell price 650 x 1.2 = 780 x 3 = 2,340.00; early bird 15 % = 351.00 - the portal shows a saving of 350.99 (was 350.98). Probably the discount is rounded per night instead of on the total. Automated test TC-SS-09.`, []],
  // ---------------- cannot be validated now (comment only, status unchanged) ----------------
  ['KAN-73', 'comment', `Not validated on 24 Nov 2026: the check needs an APPROVED contract whose currency is then removed, but the QA supplier "Testing season 3" is On hold and approving its contracts is now refused (KAN-115 fixed). Needs an Approved test supplier - kept in Ready for Testing.`, []],
  ['KAN-149', 'comment', `Not validated on 24 Nov 2026: the wrong default date only appears between 00:00 and 04:00 UAE time (UTC date); the test ran in the afternoon. Kept in Ready for Testing - to be checked in that window.`, []],
];
const plan = items.map(([key, result, comment, shots]) => {
  const copied = shots.filter(Boolean).filter(s => fs.existsSync(s)).map((s, i) => { const d = path.join(OUT, `${key}-${i + 1}.png`); fs.copyFileSync(s, d); return d.replace(/\\/g, '/'); });
  const missing = shots.filter(s => !s || !fs.existsSync(s)).length;
  if (missing) console.log(`${key}: ${missing} screenshot(s) not found`);
  return { key, result, comment, shots: copied };
});
fs.writeFileSync('reports/Jira/revalidation-24nov.json', JSON.stringify(plan, null, 1));
const count = r => plan.filter(p => p.result === r).length;
console.log(`plan: ${plan.length} issues - fixed ${count('fixed')}, reopen ${count('reopen')}, comment ${count('comment')}; screenshots ${plan.reduce((n, p) => n + p.shots.length, 0)}`);
