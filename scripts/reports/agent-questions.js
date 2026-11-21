// Builds reports/Agent-Questions/Agent-Questions.xlsx - questions to the product owner, each with a screenshot.
// Sheet "Agent" (new) + sheet "Supplier follow-up" (clarifications and what the product / rules tests raised).
// Screenshots: reports/Agent-Questions/screenshots (A-NN) and reports/Supplier-Questions/screenshots (Q-NN), screenshots/bugs (BUG-NN).
// Run:  node scripts/reports/agent-questions.js        (writes the .xlsx only - answers you type into an .ods copy are never overwritten)
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'reports', 'Agent-Questions');
const SHOT_DIRS = [path.join(OUT_DIR, 'screenshots'), path.join(ROOT, 'reports', 'Supplier-Questions', 'screenshots'), path.join(ROOT, 'screenshots', 'bugs')];
const DATE = '17-Nov-2026';

const AGENT = [
  { id: 'A-01', area: 'Agent status', q: 'What may an On Hold and a Blocked agent still do (search, book, log in to the portal, top up the wallet)? Can a Blocked agent go back to On Hold or only to Approved (like suppliers)?', seen: 'Status offers Approved / On Hold / Blocked at any time. New agents start On Hold.', tests: 'Blocked agent: edit / top-up / booking refused; status flow', opts: 'a) Same rules as supplier  b) Other' },
  { id: 'A-02', area: 'Approving an agent', q: 'Who may set an agent to Approved (restriction group)? Must anything be complete first (address, currency, credit limit, documents)?', seen: 'Any user can choose Approved directly on the Add form.', tests: 'Approve incomplete agent; approve without right', opts: '' },
  { id: 'A-03', area: 'Type and segment', q: 'What do B2B / B2C and General / Concierge / Desk mean? Does Concierge need a partner supplier and Desk a desk location (required)? Can they change after bookings exist?', seen: 'Segment B2B/B2C; client type General/Concierge/Desk. Saved as segment, clientType, partnerSupplierId, deskLocationId.', tests: 'Required fields per type; change after bookings', opts: '' },
  { id: 'A-04', area: 'Exchange type', q: 'What does "Exchange type" do (which exchange rates the agent gets)? Can it be changed later? Only "Default Exchange" exists - should there be more?', seen: 'One option: Default Exchange.', tests: 'Prices per exchange type', opts: '' },
  { id: 'A-05', area: 'Credit limit', q: 'Credit limit: minimum / maximum? Per currency? What happens when an agent books above the limit (refused, on request, approval)? A negative limit (-500) is sent today (BUG-69).', seen: 'Allow credit shows Credit limit. The test agent got 1,000 AED; USD shows "Not allowed".', tests: 'Booking above limit; limit per currency', opts: '' },
  { id: 'A-06', area: 'Payment terms', q: 'Meaning of the 5 terms and the allowed number range (0-365 days? "Nth Date Every Month" 1-28?). Is 0 days = pay at booking?', seen: 'Days After Invoice / After Arrival / Before Invoice / Before Arrival / Nth Date Every Month.', tests: 'Boundary tests per term', opts: '' },
  { id: 'A-07', area: 'Portal login (testing)', q: 'Portal access needs a Login ID and password. I do not type passwords into the live site. Can you create one test agent portal login yourself (or a test environment) so I can test the portal flows? What are the Login ID / password rules?', seen: '"Login ID is required for portal access"; a password field appears.', tests: 'Portal login rules; login on behalf', opts: 'a) I will create it and share it in .env  b) Skip portal for now' },
  { id: 'A-08', area: 'Markets', q: 'What do Markets and Allotment markets do on an agent (which contract rates / allotments the agent can use)? Empty = all markets?', seen: 'Markets: Default Market, Asian Market. Empty by default ("No markets").', tests: 'Agent in Asian Market sees only Asian-market rates', opts: '' },
  { id: 'A-09', area: 'Agent currencies', q: 'Can the default currency be changed / removed (AED cannot be removed today)? Is credit set per currency (USD shows "Not allowed")? Removing a currency with a balance - allowed?', seen: 'Currencies table: wallet, credit available, promotional, supplier credit per currency. "Remove currency" is disabled for the default.', tests: 'Remove currency with balance; change default', opts: '' },
  { id: 'A-10', area: 'Wallet top-up', q: 'Payment modes, maximum amount, is the Reference mandatory? Does a top-up need approval before it is usable? Can a top-up be reversed?', seen: 'Add wallet top-up: Currency, Amount, Payment mode (Bank transfer...), Reference, Notes. Saved instantly (wallet 100.00 AED).', tests: 'Top-up limits, reversal, approval', opts: '' },
  { id: 'A-11', area: 'Ledger actions', q: 'Who may use Record credit settlement, Ledger adjustment, Grant promotional credit and Record supplier credit? Can a deduction take the wallet below 0?', seen: 'All four are open to the test user; each needs an amount > 0 and notes.', tests: 'Deduct more than the wallet; rights', opts: '' },
  { id: 'A-12', area: 'Ledger adjustment', q: 'Ledger adjustment on Account "Credit" - what does it change (credit used or the limit)? Should every adjustment need approval?', seen: 'Account Wallet / Credit, Direction Add (+) / Deduct (−), Amount, Reference, Notes*.', tests: 'Credit-account adjustment', opts: '' },
  { id: 'A-13', area: 'Loyalty points', q: 'How is loyalty switched on ("0 pts · off")? How are points earned, do they expire, what are they worth? (Taking off more points than the agent has is refused - correct?)', seen: 'Adjust: Give (+) / Take off (−), whole points, notes required.', tests: 'Earn / expire / redeem points', opts: '' },
  { id: 'A-14', area: 'Credit requests', q: 'Who raises a credit request (agent in the portal?), who approves it, and what limits apply? What does "Only my agents" filter on (account manager)?', seen: 'Credit Requests page: Pending / All, "Only my agents". No requests exist to test with.', tests: 'Request -> approve / reject -> credit limit changes', opts: '' },
  { id: 'A-15', area: 'Products access', q: 'If a product (e.g. Villa) is switched off for an agent, can the agent still see / book it anywhere (portal, quotes, on-behalf)?', seen: 'Products "8 of 9 on"; the test switched Villa off and it stayed off.', tests: 'Booking a switched-off product is refused', opts: '' },
  { id: 'A-16', area: 'Portal access settings', q: 'Payments: wallet payments, wallet top-ups, online payments, pay balance online, gateways - which combinations are valid? What is "Company settings"?', seen: 'Portal login: Sign-in Blocked, Login ID Not set; Payments: Allowed / Off / All / Service default.', tests: 'Each payment setting in the portal', opts: '' },
  { id: 'A-17', area: 'Login on behalf / Cancel & change', q: 'What may staff do with "Login on behalf" (0 of 5)? What is "Cancel & change" (who may cancel or change bookings)?', seen: 'Both have their own Edit buttons on Access.', tests: 'Rights per option', opts: '' },
  { id: 'A-18', area: 'On-behalf activity', q: 'What should appear under "Done for this agent" and "Done by this agent"? Every booking / change / top-up made on behalf?', seen: 'Two tabs and an "Any acting agent" filter; empty for AG-00002.', tests: 'Activity log after an on-behalf booking', opts: '' },
  { id: 'A-19', area: 'Plan & tier', q: 'Where are agent plans and tiers defined, and what do they change (features, prices, markup)?', seen: 'Overview: Agent plan "No plan", Tier "No tier", "Plan & tier" with features.', tests: 'Plan / tier effects', opts: '' },
  { id: 'A-20', area: 'Addresses', q: 'Which address fields are required? Phone format? (The phone is stored without spaces: "+97145550100".) Can primary and correspondence address be copied?', seen: 'Primary and Correspondence address with street, area, country, state, city, phone, email, fax.', tests: 'Required fields, phone format', opts: '' },
  { id: 'A-21', area: 'Agent list and codes', q: 'Should the list also search by code, country, account manager, city? Is the agent name unique? Is an agent ever deleted (codes AG-00001.. never reused)?', seen: 'List: Code (sort only), Name, Email, Country (filter), Status. A duplicate EMAIL is refused (correct); duplicate name not tested yet.', tests: 'Duplicate name; extra search fields', opts: '' },
  { id: 'A-22', area: 'Account manager / designation', q: 'Is an account manager required? Who can be one (any user)? What is "Designation" used for?', seen: 'Account manager "Sahil Chauhan", designation "Senior Travel Consultant" on AG-00002.', tests: 'Required / allowed values', opts: '' },
];

const SUPPLIER_FOLLOW_UP = [
  { id: 'S-01', shot: 'Q-05', area: 'Primary contact (Q-05 "a")', q: 'Your answer was "a": exactly one primary contact, it can be moved to another contact, and it cannot be deleted. Correct?', seen: '', tests: 'Move primary, delete primary', opts: 'Yes / No' },
  { id: 'S-02', shot: 'Q-15', area: 'Sell / valid dates (Q-15 "a")', q: '"a" = Sell to must be on or before Valid to (BUG-62 raised). Is a Valid from in the past allowed?', seen: 'A contract valid from 01 Jan 2020 is accepted.', tests: 'Past validity', opts: '' },
  { id: 'S-03', shot: 'Q-17', area: 'Contract code (Q-17 "a")', q: '"a" = contract code optional, unique when filled. Correct? (Duplicate codes not tested yet.)', seen: '', tests: 'Duplicate code', opts: 'Yes / No' },
  { id: 'S-04', shot: 'Q-22', area: 'Blackout dates (Q-61, blank)', q: 'Promotion blackout dates: the promotion does not apply to STAYS on those dates, or to BOOKINGS made on those dates?', seen: '', tests: 'Blackout behaviour', opts: 'a) Stay dates  b) Booking dates' },
  { id: 'S-05', shot: 'Q-11', area: 'Other products (Q-62 "b")', q: 'You answered "b" (Excursion / Transfer rules differ from Hotel). Which rules differ?', seen: 'Excursions / transfers: Service on / by, Max capacity, pax bands, sub services, ticketing, height.', tests: 'Product-specific contract and allotment rules', opts: '' },
  { id: 'S-06', shot: 'Q-04', area: 'Phone format (Q-35)', q: 'Which phone format should contacts accept (e.g. +971 4 555 0900, country code required)?', seen: 'Any text is accepted; agents store phones without spaces.', tests: 'Phone validation', opts: '' },
  { id: 'S-07', shot: 'BUG-68', area: 'Room names', q: 'Must room names be unique per hotel? Today two rooms with the same name are saved (raised as BUG-68).', seen: 'Two "QA Auto Room ... edited" rooms side by side.', tests: 'Duplicate room name', opts: 'Yes, unique / No' },
  { id: 'S-08', shot: 'Q-18', area: 'Overlapping seasons', q: 'Adding a season over existing dates SPLITS them automatically (16-22 Nov / 23 Nov - 15 Nov). Is that wanted, or should the screen refuse the overlap and ask?', seen: 'Season 1 was shortened silently when Season 2 was added with the same dates.', tests: 'Overlap handling', opts: 'a) Split is fine  b) Refuse and ask' },
  { id: 'S-09', shot: 'Q-18', area: 'Missing-price message', q: 'With a missing price the contract is NOT saved ("1 problem to fix") - matching your rule - but the warning text says "The contract saves as a draft". Should the text change?', seen: '"3 prices are missing ... The contract saves as a draft, but every room needs a price ... before it can be approved."', tests: 'Message text', opts: 'Yes, change the text / No' },
  { id: 'S-10', shot: 'Q-11', area: 'Deactivating a product', q: 'You said products are deactivated, never deleted - but a room / excursion has no Active switch (only per occupancy row). How is a product deactivated?', seen: 'Products list shows All / Active / Inactive counts; no Active switch on the product form.', tests: 'Deactivate product', opts: '' },
  { id: 'S-11', shot: 'Q-13', area: 'Second user (Q-63)', q: 'Please create a low-access test user in the ERP and put its login in .env as ERP_USERNAME2 / ERP_PASSWORD2 (I do not set or type passwords on the live site). Which rights should it lack?', seen: '', tests: 'Approve supplier / contract without rights', opts: '' },
];

async function sheet(wb, name, title, rows, shots) {
  const font = { name: 'Arial', size: 10 };
  const head = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  const answerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 20 }, { width: 46 }, { width: 38 }, { width: 30 }, { width: 26 }, { width: 40 }, { width: 60 }, { width: 30 }];
  ws.mergeCells('A1:I1'); ws.getCell('A1').value = title; ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  ws.mergeCells('A2:I2'); ws.getCell('A2').value = `Date: ${DATE}   |   Please write your answer in the yellow "Your answer" column. Each answer becomes new automated test scenarios.`;
  ws.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const hr = ws.getRow(4);
  ['ID', 'Area', 'Question', 'What we saw', 'Tests the answer will drive', 'Possible answers', 'Your answer', 'Screenshot', 'Screenshot file'].forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = head; c.fill = headFill; c.border = border; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  rows.forEach((q, i) => {
    const r = ws.getRow(5 + i);
    const hit = shots.find(s => s.name.startsWith((q.shot ?? q.id) + '-'));
    r.values = [q.id, q.area, q.q, q.seen, q.tests, q.opts, '', hit ? '' : 'no screenshot', hit ? hit.name : '-'];
    r.eachCell({ includeEmpty: true }, (c, col) => { c.font = font; c.border = border; c.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 ? 'center' : 'left' }; });
    r.getCell(1).font = { ...font, bold: true };
    r.getCell(7).fill = answerFill;
    if (hit) {
      r.height = 200;
      const img = wb.addImage({ filename: hit.full, extension: 'png' });
      ws.addImage(img, { tl: { col: 7.05, row: 4 + i + 0.05 }, ext: { width: 410, height: 260 }, editAs: 'oneCell' });
      r.getCell(9).value = { text: hit.name, hyperlink: `screenshots/${hit.name}` };
      r.getCell(9).font = { ...font, color: { argb: 'FF0563C1' }, underline: true };
    } else r.height = 90;
  });
}

async function main() {
  fs.mkdirSync(path.join(OUT_DIR, 'screenshots'), { recursive: true });
  const shots = SHOT_DIRS.filter(d => fs.existsSync(d)).flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.png')).map(f => ({ name: f, full: path.join(d, f) })));
  // keep every referenced screenshot next to the workbook so the links work
  for (const q of [...AGENT, ...SUPPLIER_FOLLOW_UP]) {
    const hit = shots.find(s => s.name.startsWith((q.shot ?? q.id) + '-'));
    if (hit && path.dirname(hit.full) !== path.join(OUT_DIR, 'screenshots')) fs.copyFileSync(hit.full, path.join(OUT_DIR, 'screenshots', hit.name));
  }
  const wb = new ExcelJS.Workbook();
  await sheet(wb, 'Agent', 'ERP (Pilot) - Agent module: questions for the product owner', AGENT, shots);
  await sheet(wb, 'Supplier follow-up', 'ERP (Pilot) - Supplier module: follow-up questions (clarifications + product testing)', SUPPLIER_FOLLOW_UP, shots);
  const out = path.join(OUT_DIR, 'Agent-Questions.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`written ${out}: ${AGENT.length} agent + ${SUPPLIER_FOLLOW_UP.length} supplier follow-up questions`);
}
main().catch(e => { console.error(e); process.exit(1); });
