// Builds reports/Round3-Questions/Round3-Questions.xlsx - business-scenario questions (Supplier, Agent, B2B booking).
// Run:  node scripts/round3-questions.js   (answers you type are never overwritten: this writes a fresh file only when run)
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'reports', 'Round3-Questions');
const SHOT_DIRS = [path.join(OUT_DIR, 'screenshots'), path.join(ROOT, 'reports', 'Supplier-Questions', 'screenshots'), path.join(ROOT, 'reports', 'Agent-Questions', 'screenshots'), path.join(ROOT, 'screenshots', 'bugs')];
const DATE = '17-Nov-2026';

const SUPPLIER_FOLLOW_UP = [
  { id: 'S-01', shot: 'Q-05', area: 'Primary contact (Q-05 "a")', q: 'Your answer was "a": exactly one primary contact, it can be moved to another contact, and it cannot be deleted. Correct?', tests: 'Move primary, delete primary', },
  { id: 'S-02', shot: 'Q-15', area: 'Sell / valid dates (Q-15 "a")', q: '"a" = Sell to must be on or before Valid to (BUG-62 raised). Is a Valid from in the past allowed?', tests: 'Past validity', },
  { id: 'S-03', shot: 'Q-17', area: 'Contract code (Q-17 "a")', q: '"a" = contract code optional, unique when filled. Correct? (Duplicate codes not tested yet.)', tests: 'Duplicate code', },
  { id: 'S-04', shot: 'Q-22', area: 'Blackout dates (Q-61, blank)', q: 'Promotion blackout dates: the promotion does not apply to STAYS on those dates, or to BOOKINGS made on those dates?', tests: 'Blackout behaviour', },
  { id: 'S-05', shot: 'Q-11', area: 'Other products (Q-62 "b")', q: 'You answered "b" (Excursion / Transfer rules differ from Hotel). Which rules differ?', tests: 'Product-specific contract and allotment rules', },
  { id: 'S-06', shot: 'Q-04', area: 'Phone format (Q-35)', q: 'Which phone format should contacts accept (e.g. +971 4 555 0900, country code required)?', tests: 'Phone validation', },
  { id: 'S-07', shot: 'BUG-68', area: 'Room names', q: 'Must room names be unique per hotel? Today two rooms with the same name are saved (raised as BUG-68).', tests: 'Duplicate room name', },
  { id: 'S-08', shot: 'Q-18', area: 'Overlapping seasons', q: 'Adding a season over existing dates SPLITS them automatically (16-22 Nov / 23 Nov - 15 Nov). Is that wanted, or should the screen refuse the overlap and ask?', tests: 'Overlap handling', },
  { id: 'S-09', shot: 'Q-18', area: 'Missing-price message', q: 'With a missing price the contract is NOT saved ("1 problem to fix") - matching your rule - but the warning text says "The contract saves as a draft". Should the text change?', tests: 'Message text', },
  { id: 'S-10', shot: 'Q-11', area: 'Deactivating a product', q: 'You said products are deactivated, never deleted - but a room / excursion has no Active switch (only per occupancy row). How is a product deactivated?', tests: 'Deactivate product', },
  { id: 'S-11', shot: 'Q-13', area: 'Second user (Q-63)', q: 'Please create a low-access test user in the ERP and put its login in .env as ERP_USERNAME2 / ERP_PASSWORD2 (I do not set or type passwords on the live site). Which rights should it lack?', tests: 'Approve supplier / contract without rights', },
];

const SUPPLIER = [
  { id: 'S3-01', shot: 'Q-01', area: 'On-hold supplier selling', q: 'Can contracts of an On hold supplier be approved and sold in B2B, or only after the supplier is Approved?', tests: 'Book a product of an On hold supplier' },
  { id: 'S3-02', shot: 'Q-19', area: 'Child policy overlap', q: 'Child bands may overlap (your answer). When two bands match a child of 8, which band prices the child (first, cheapest, most specific)?', tests: 'Price a child in overlapping bands' },
  { id: 'S3-03', shot: 'Q-49', area: 'Extra bed price', q: 'When is the extra-bed supplement charged: always for the 3rd adult, or only when the occupancy says "+bed"? Is a child in an extra bed charged child or extra-bed price?', tests: 'Price 3 adults / 2+1 child' },
  { id: 'S3-04', shot: 'Q-45', area: 'Contract market vs agent market', q: 'Agent in "Asian Market" - does it see contracts for "All markets" as well as "Asian Market"? If both match, which one wins (priority)?', tests: 'B2B search per agent market' },
  { id: 'S3-05', shot: 'Q-22', area: 'Promotion stacking', q: 'Two promotions on one stay: if both are Combinable, are the discounts added (40% + 5% = 45%) or applied one after the other (40% then 5% of the rest = 43%)? If one is "Best offer only", which is used?', tests: 'Price with 2 promotions' },
  { id: 'S3-06', shot: 'Q-22', area: 'Early bird + last minute', q: 'May one promotion have both Early bird and Last-minute days? What do "Min nights / Max nights" on a promotion do if the season has its own min stay?', tests: 'Booking-window rules' },
  { id: 'S3-07', shot: 'Q-21', area: 'Release / cut-off in B2B', q: 'When release days have passed (or on a cut-off day), what does the agent see in B2B: room hidden, "on request", or bookable from free sale?', tests: 'B2B search inside release window' },
  { id: 'S3-08', shot: 'Q-21', area: 'Allotment sold out', q: 'When all allotment units are sold: is the room hidden, shown "on request" (Type On request), or still sold (Free sale)? Who confirms an on-request booking and how fast?', tests: 'Sell beyond allotment' },
  { id: 'S3-09', shot: 'Q-09', area: 'Contract currency vs agent currency', q: 'Contract in AED, agent books in USD: is the price converted with the agent\'s exchange type? Rounded how (2 decimals, up)?', tests: 'Currency conversion in B2B price' },
  { id: 'S3-10', shot: 'Q-14', area: 'Taxes and commission', q: 'Contracts carry "rates include tax" and "commission" settings in the saved data, but the screen does not show them. Are taxes (VAT, tourism fee) and supplier commission part of this phase?', tests: 'Tax / commission in price' },
  { id: 'S3-11', shot: 'Q-15', area: 'Book before vs release', q: 'Contract "Book before 3 days" and allotment "release 7 days" - which applies when they differ?', tests: 'Booking window conflict' },
  { id: 'S3-12', shot: 'Q-20', area: 'Cancellation at booking time', q: 'If the cancellation policy changes after a booking is made, does the booking keep the policy it was booked with?', tests: 'Cancel an old booking after a policy change' },
  { id: 'S3-14', shot: 'Q-13', area: 'Contract approval flow', q: 'Draft -> "Submit for approval" -> "Pending approval" -> Approve. May the person who submitted also approve? Can a Draft be approved directly from the list without submitting (it can today)?', tests: 'Approval flow and rights' },
  { id: 'S3-13', shot: 'Q-26', area: 'Copy of an approved contract', q: 'Is a copied contract always Draft (needs approval), even when the original was Approved? Does the copy keep allotments / promotions?', tests: 'Copy approved contract' },
];

const AGENT = [
  { id: 'A3-01', shot: 'A-05', area: 'Credit limit reached', q: 'Booking 1,500 AED with 1,000 credit left: refused, or pay 1,000 on credit + 500 from wallet / gateway (split payment)?', tests: 'Booking above remaining credit' },
  { id: 'A3-02', shot: 'A-10', area: 'Wallet + gateway', q: 'Wallet has 80 AED, booking costs 100 AED: may the agent pay 80 from wallet and 20 by gateway, or must one method pay all?', tests: 'Split wallet / gateway' },
  { id: 'A3-03', shot: 'A-12', area: 'Credit settlement', q: '"Record credit settlement": does it reduce the used credit? Is settling more than the used credit allowed (over-payment goes to wallet?)', tests: 'Settle credit' },
  { id: 'A3-04', shot: 'A-14', area: 'Credit request approval', q: 'When finance approves a credit request, does the credit limit change automatically? Is there a maximum, and an expiry date?', tests: 'Approve / reject credit request' },
  { id: 'A3-05', shot: 'A-11', area: 'Promotional / supplier credit', q: 'How can an agent spend promotional credit and supplier credit (all products? one supplier only? expiry?) Can they be mixed with wallet in one booking?', tests: 'Pay with promotional / supplier credit' },
  { id: 'A3-06', shot: 'A-19', area: 'Agent markup', q: 'What price does the agent see: contract cost + a markup? Where is the markup set (plan, tier, market, agent)? Can the agent add his own markup for his clients?', tests: 'B2B price = cost + markup' },
  { id: 'A3-07', shot: 'A-16', area: 'Portal users', q: 'Can an agent have several portal users with different rights (e.g. booker cannot pay with credit)? Who creates them - ERP staff or the agent admin?', tests: 'Portal user rights' },
  { id: 'A3-08', shot: 'A-17', area: 'On-behalf booking payment', q: 'Staff books on behalf of an agent: whose wallet / credit is used, and who appears as the booker in audit (your answer: the on-behalf user)?', tests: 'On-behalf booking' },
  { id: 'A3-09', shot: 'A-09', area: 'Refunds', q: 'Cancelled booking: is the refund returned to the same method (wallet / credit / gateway) or always to the wallet? Minus the cancellation charge?', tests: 'Refund flows' },
  { id: 'A3-10', shot: 'A-01', area: 'Blocked agent with bookings', q: 'An agent is blocked while having future bookings: are those bookings kept, can they still be cancelled / amended by staff?', tests: 'Block agent with bookings' },
  { id: 'A3-11', shot: 'A-09', area: 'Booking currency', q: 'Is a B2B booking always in the agent\'s default currency, or can the agent choose any of its currencies?', tests: 'Currency selection in B2B' },
  { id: 'A3-13', shot: 'A-17', area: 'Login on behalf rule', q: 'Login on behalf is refused while the agent is On Hold ("isn\'t active and approved") and allowed once Approved. Correct? What happens to on-behalf access when the agent is later Blocked?', tests: 'On-behalf access per status' },
  { id: 'A3-12', shot: 'A-20', area: 'Notifications', q: 'Which emails are sent (booking confirmation, voucher, invoice, credit low, top-up received) and to whom (agent email, portal user, account manager)?', tests: 'Email checks' },
];

const B2B = [
  { id: 'B-01', area: 'Test logins (needed first)', q: 'The B2B login needs Company code, Sign-in ID and password. Please create test agent logins and put them in .env (I never type passwords myself): B2B_COMPANY, B2B_LOGIN_CREDIT / B2B_PASSWORD_CREDIT (approved agent with credit), B2B_LOGIN_WALLET / ... (wallet only), B2B_LOGIN_BLOCKED / ... (blocked agent).', tests: 'All B2B tests' },
  { id: 'B-02', shot: 'B-01', area: 'Payment gateway test mode', q: 'Does the payment gateway have a sandbox / test mode on this environment, with published test card numbers? (Only then can the tests pay by gateway.)', tests: 'Gateway payments' },
  { id: 'B-03', shot: 'B-01', area: 'Booking flow', q: 'Which products can be booked in B2B now (hotel, excursion, private transfer, packages)? What are the steps (search > select > guest details > payment > confirmation)?', tests: 'End-to-end booking per product' },
  { id: 'B-04', shot: 'B-01', area: 'Test bookings', q: 'Bookings cannot be deleted. May the tests create "QA Auto" bookings on the test agents and cancel them right after (same as other QA data)?', tests: 'Booking + cancel per scenario' },
  { id: 'B-05', shot: 'B-01', area: 'Price shown', q: 'Should B2B show a price breakdown (room, supplements, promotion discount, taxes)? Must the B2B total equal what the ERP shows on the reservation?', tests: 'Price checks B2B vs ERP' },
  { id: 'B-06', shot: 'B-01', area: 'Amend / cancel', q: 'Can the agent amend (dates, guests) and cancel from B2B? Are cancellation charges taken automatically from the policy?', tests: 'Amend / cancel flows' },
  { id: 'B-07', shot: 'B-01', area: 'Vouchers and invoices', q: 'Are vouchers and invoices generated in B2B and in the ERP? Which numbering?', tests: 'Documents after booking' },
  { id: 'B-08', shot: 'B-01', area: 'Insufficient funds', q: 'Wallet too low and no credit: does B2B offer a top-up / gateway, or block the booking with a message?', tests: 'Low-balance booking' },
  { id: 'B-09', shot: 'A-17', area: 'Login on behalf', q: 'Does "Login on behalf" in the ERP open B2B as that agent? Which rights apply (the 5 options)?', tests: 'Login on behalf flow' },
  { id: 'B-10', area: 'Size of the test set', q: 'For 10,000+ cases I will build data-driven matrices (product x market x agent type x payment method x promotion x date window) instead of writing each case by hand. Which combinations matter most for the business (top 5)?', tests: 'Prioritised matrix' },
];

async function sheet(wb, name, title, rows, shots) {
  const font = { name: 'Arial', size: 10 };
  const head = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  const answerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 22 }, { width: 58 }, { width: 28 }, { width: 44 }, { width: 60 }, { width: 30 }];
  ws.mergeCells('A1:G1'); ws.getCell('A1').value = title; ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  ws.mergeCells('A2:G2'); ws.getCell('A2').value = `Date: ${DATE}   |   Write your answer in the yellow column. Each answer becomes automated test scenarios.`;
  ws.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const hr = ws.getRow(4);
  ['ID', 'Area', 'Question', 'Tests the answer will drive', 'Your answer', 'Screenshot', 'Screenshot file'].forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = head; c.fill = headFill; c.border = border; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  rows.forEach((q, i) => {
    const r = ws.getRow(5 + i);
    const hit = q.shot ? shots.find(s => s.name.startsWith(q.shot + '-')) : null;
    r.values = [q.id, q.area, q.q, q.tests, '', hit ? '' : '-', hit ? hit.name : '-'];
    r.eachCell({ includeEmpty: true }, (c, col) => { c.font = font; c.border = border; c.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 ? 'center' : 'left' }; });
    r.getCell(1).font = { ...font, bold: true };
    r.getCell(5).fill = answerFill;
    if (hit) {
      r.height = 190;
      const img = wb.addImage({ filename: hit.full, extension: 'png' });
      ws.addImage(img, { tl: { col: 5.05, row: 4 + i + 0.05 }, ext: { width: 400, height: 250 }, editAs: 'oneCell' });
      r.getCell(7).value = { text: hit.name, hyperlink: `screenshots/${hit.name}` };
      r.getCell(7).font = { ...font, color: { argb: 'FF0563C1' }, underline: true };
    } else r.height = 80;
  });
}

async function main() {
  fs.mkdirSync(path.join(OUT_DIR, 'screenshots'), { recursive: true });
  const shots = SHOT_DIRS.filter(d => fs.existsSync(d)).flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.png')).map(f => ({ name: f, full: path.join(d, f) })));
  for (const q of [...SUPPLIER_FOLLOW_UP, ...SUPPLIER, ...AGENT, ...B2B]) {
    const hit = q.shot ? shots.find(s => s.name.startsWith(q.shot + '-')) : null;
    if (hit && path.dirname(hit.full) !== path.join(OUT_DIR, 'screenshots')) fs.copyFileSync(hit.full, path.join(OUT_DIR, 'screenshots', hit.name));
  }
  const wb = new ExcelJS.Workbook();
  await sheet(wb, 'Supplier follow-up', 'Open from the previous round - Supplier follow-up (S-01 to S-11)', SUPPLIER_FOLLOW_UP.map(q => ({ ...q, tests: q.tests })), shots);
  await sheet(wb, 'Supplier', 'Round 3 - Supplier business scenarios', SUPPLIER, shots);
  await sheet(wb, 'Agent', 'Round 3 - Agent business scenarios (credit, wallet, payments)', AGENT, shots);
  await sheet(wb, 'B2B', 'Round 3 - B2B booking portal (https://b2b.nexgenpilot.com)', B2B, shots);
  const out = path.join(OUT_DIR, 'Open-Questions.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`written ${out}: ${SUPPLIER_FOLLOW_UP.length} follow-up + ${SUPPLIER.length} supplier + ${AGENT.length} agent + ${B2B.length} B2B questions`);
}
main().catch(e => { console.error(e); process.exit(1); });
