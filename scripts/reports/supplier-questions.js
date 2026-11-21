// Builds reports/Supplier-Questions/Supplier-Questions.xlsx - questions to the product owner, each with a screenshot.
// Screenshots come from scripts/evidence/capture-supplier-questions.mjs (reports/Supplier-Questions/screenshots/Q-NN-*.png).
// Run:  node scripts/reports/supplier-questions.js
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', '..', 'reports', 'Supplier-Questions');
const SHOTS = path.join(OUT_DIR, 'screenshots');
const DATE = '16-Nov-2026';

// area, question, why we ask (what we saw), the test(s) the answer will drive, suggested answer options
const Q = [
  // ---------------- Supplier ----------------
  { id: 'Q-01', area: 'Supplier status', q: 'What may an "On hold" and a "Blocked" supplier still do? Can their contracts still price bookings, can new contracts be added, can bookings be made?',
    seen: 'Status has 3 buttons (Approved / On Hold / Blocked). "Testing season 3" is On hold and we could still add contracts, approve one and price a stay with Rate check.',
    tests: 'Block a supplier -> Rate check / Product Search / booking must (not) find it; Add contract must (not) be allowed', opts: 'a) Only Approved suppliers can be booked  b) On hold = no new bookings, Blocked = nothing  c) Other' },
  { id: 'Q-02', area: 'Supplier code', q: 'How is the supplier code built ("DXB-001", "ABD-001", "SUP-002")? Is it city code + number? Can it ever be changed?',
    seen: 'The code is "Assigned when saved" and locked, also in Edit. New Dubai suppliers got DXB-001..009; older ones are SUP-00x.',
    tests: 'Code format per city, numbering after a gap, uniqueness across cities', opts: 'a) <City code>-<3-digit running number>  b) Other' },
  { id: 'Q-03', area: 'Delete supplier', q: 'Is it intended that a supplier can never be deleted (only Blocked)? Should a supplier with no contracts/bookings be deletable?',
    seen: 'There is no Delete anywhere; test suppliers can only be set to Blocked.', tests: 'Delete rules / Block as soft-delete', opts: 'a) Never delete  b) Delete when unused  c) Other' },
  { id: 'Q-04', area: 'Contact roles', q: 'Which contact roles should exist? The list only offers "Admin". Where are roles maintained?',
    seen: 'Add contact -> Role offers only "Admin".', tests: 'Role list, role required, one contact per role?', opts: 'a) Reservations / Sales / Accounts / Admin ...  b) Maintained in Core > ...' },
  { id: 'Q-05', area: 'Primary contact', q: 'Must every supplier have exactly one primary contact? Can the primary contact be changed to another contact or deleted?',
    seen: 'The first contact becomes Primary and the switch is locked; only one is Primary when a second is added.', tests: 'Move Primary, delete Primary, supplier without contact', opts: 'a) Exactly one, can be moved, cannot be deleted  b) Other' },
  { id: 'Q-06', area: 'Supplier currency used by a contract', q: 'Should it be possible to remove a currency from a supplier while an APPROVED contract still uses it?',
    seen: 'Marina Bay Hotel\'s approved contract shows Currency "UAE Dirham (no longer on the supplier)" - the currency was removed from the supplier but the contract still prices in it.',
    tests: 'Remove a used currency -> refused (or contract warned / back to Draft)', opts: 'a) Must be refused  b) Allowed, contract keeps pricing  c) Allowed, contract goes to Draft' },
  { id: 'Q-07', area: 'Payment terms', q: 'Limits for "Payment due" (days) and "Advance": maximum days? Advance fixed amount - any limit? Is 0 days allowed?',
    seen: 'Defaults: Days after invoice, 30 days, Percentage, 0. Advance > 100% and negative days are refused.', tests: 'Boundary tests on days and advance', opts: 'e.g. days 0-365, fixed advance <= ... ' },
  { id: 'Q-08', area: 'Bank account', q: 'Should IBAN be checked (country format / check digits)? Can one currency have more than one bank account? Which one is used for payment?',
    seen: 'IBAN accepts any text up to 50 characters; SWIFT is not checked (BUG-46).', tests: 'IBAN format, 2 accounts per currency, default account', opts: 'a) Validate IBAN  b) Free text' },
  { id: 'Q-09', area: 'Tax fields', q: 'Should PAN / TAN / VAT have a format check (e.g. Indian PAN = 10 characters "ABCDE1234F", UAE TRN = 15 digits)? Are they required for some countries?',
    seen: 'Only length limits: PAN 20, TAN 20, VAT 30.', tests: 'Format and required-by-country tests', opts: 'a) Validate per country  b) Free text' },
  { id: 'Q-10', area: 'Documents & portal', q: 'Which documents count in "x of y uploaded" and are any mandatory before a supplier can be Approved? Who creates the supplier portal login and what can the supplier do there?',
    seen: 'Overview shows "Documents x of y uploaded" and "Supplier portal: No login".', tests: 'Upload types/size, approval blocked without documents, portal login flow', opts: '' },
  { id: 'Q-11', area: 'Products offered', q: 'A service that already has products cannot be removed. Should the same apply when it has contracts / allotments / bookings? What happens to them if it could?',
    seen: 'Edit products offered shows a hint that a service with products cannot be removed.', tests: 'Remove service with contracts', opts: '' },
  { id: 'Q-12', area: 'Content', q: 'Are any of the 8 content sections required (e.g. Description, Images) before the hotel can be sold? Image limits (count, size, type)?',
    seen: 'Content tab: Overview, Description, Images, Property and rooms, Dining and recreation, Location and attractions, Policies and instructions, Fees and renovation.', tests: 'Required content, image upload limits', opts: '' },
  // ---------------- Contract ----------------
  { id: 'Q-13', area: 'Contract approval', q: 'Who may approve a contract? Can the person who created it approve it himself? Should approval be blocked while prices are missing?',
    seen: 'The same user (sahil) could create and approve a contract straight from the list (green tick "Approve"). Inactive drafts show no Approve button.',
    tests: 'Approve by creator / other role, approve with missing prices, approve inactive contract', opts: 'a) Any user  b) Only role X, not the creator' },
  { id: 'Q-14', area: 'Editing an approved contract', q: 'Saving any change to an approved contract sends it back to Draft, and "until it is approved again it will not price bookings". Is that intended even for small changes (e.g. remarks)?',
    seen: 'Dialog "Save and return to Draft?" on every save of an approved contract.', tests: 'Which fields trigger re-approval', opts: 'a) Every change  b) Only prices/dates/policies' },
  { id: 'Q-15', area: 'Contract dates', q: 'Sell from before Valid from is allowed (confirmed). Is "Sell to" AFTER "Valid to" allowed? Is "Valid from" in the past allowed (e.g. 2020)?',
    seen: 'Both were accepted and sent to the server. Sell from after Sell to is refused.', tests: 'Date boundary tests', opts: 'a) Sell to must be <= Valid to  b) Allowed' },
  { id: 'Q-16', area: 'Priority', q: 'What if two contracts for the same product and dates have the SAME priority? Should overlapping contracts with equal priority be refused? (Negative priority is reported as BUG-49.)',
    seen: 'Help text: "When two contracts could price the same stay, the lower number wins."', tests: 'Overlap + equal priority -> refused / which one prices', opts: 'a) Refuse equal priority on overlap  b) Newest wins  c) Cheapest wins' },
  { id: 'Q-17', area: 'Contract code', q: 'Is the contract Code required and must it be unique (per supplier or overall)?',
    seen: 'Code is optional; we could save contracts without a code.', tests: 'Duplicate code, empty code', opts: 'a) Optional, unique when given  b) Required + unique' },
  { id: 'Q-18', area: 'Missing prices / allotment', q: 'A draft saves with missing prices. Should approval be refused until every room has a price in every season? Should a contract without allotment be "on request" only?',
    seen: 'Warnings: "3 prices are missing ... every room needs a price in every season before it can be approved" and "No allotment holds Club ... bookings go on request".', tests: 'Approve with missing prices; booking on request', opts: '' },
  { id: 'Q-19', area: 'Child policy', q: 'Child age bands: maximum child age? Can bands overlap? Without a band children are charged as adults - correct for all base plans?',
    seen: '"No child bands yet. Without one, children are charged as adults."', tests: 'Overlapping bands, age limits, free child', opts: '' },
  { id: 'Q-20', area: 'Cancellation policy', q: 'Can cancellation bands overlap or leave gaps (e.g. 8-14 days and 3-7 days, nothing for 15+)? Is "No-show" required? Can the charge be more than 100%?',
    seen: 'Marina Bay: 8-14 days 25%, 3-7 days 50%, within 2 days 100%, No-show 100%.', tests: 'Overlap/gap/over-100% tests', opts: '' },
  { id: 'Q-21', area: 'Allotment', q: 'Meaning of Release (days), Cut-off and Sale (Open/...) per block? What happens when bookings exceed the units - refused or on request? Difference Guaranteed / Free sale / On request?',
    seen: 'Add allotment: Type Guaranteed / Free sale / On request, Counted in Room, Per day or Shared pool, blocks with Units, Release 7, Cut-off 0, Sale Open.', tests: 'Release and overbooking tests', opts: '' },
  { id: 'Q-22', area: 'Promotion', q: 'Can Early bird and Last minute be set together? What does "Combinable" mean with 2 promotions on one stay? Max discount (100%)? Required fields?',
    seen: 'Empty promotion shows "2 problems to fix"; 5 benefit types (Discount, Stay/pay, Meal upgrade, Room upgrade, FOC).', tests: 'Combination and limit tests', opts: '' },
  { id: 'Q-23', area: 'Import from Excel', q: 'Can we get a filled example workbook? Which errors must the import catch (wrong room names, overlapping seasons, missing prices)? Does it ever update an existing contract?',
    seen: 'Upload contract from Excel: template download, .xlsx up to 5 MB, "Checked before anything is created", saved as Draft.', tests: 'Import good file / each error case / >5 MB', opts: '' },
  { id: 'Q-24', area: 'Rate check', q: 'Should Rate check include promotions, allotment availability and inactive/draft contracts? Which contract wins when two match?',
    seen: 'Rate check prices a stay (room, check-in, nights, rooms, adults, board, market, booked on, children).', tests: 'Expected prices for given stays (please give 2-3 examples with the expected total)', opts: '' },
  { id: 'Q-25', area: 'Bulk actions', q: 'What exactly should Roll over, Extend and Change prices do (new contract as Draft? + how many days? % change)? Can they be undone?',
    seen: 'Contracts list: tick contracts -> Roll over / Extend / Change prices / Activate / Deactivate.', tests: 'One test per bulk action', opts: '' },
  { id: 'Q-26', area: 'Active vs Status', q: 'What is the difference between Active = No and Status Draft? Does an inactive APPROVED contract price bookings?',
    seen: 'Contracts have both a Status (Draft/Approved) and an Active switch; inactive drafts have no Approve button.', tests: 'Inactive approved contract in Rate check', opts: '' },
];

// Answers received from the product owner (16-Nov-2026)
const ANSWERS = {
  'Q-01': 'Blocked = deactivated: no new detail can be saved on a blocked supplier. On hold: the details can still be edited.',
  'Q-06': 'A supplier can deal in several currencies (e.g. USD and AED). If a currency used by a contract is removed from Financials, show a popup that a contract uses this currency and move that contract to Provisional, so no booking can be made on it.',
  'Q-13': 'Anyone who has access to modify that contract (defined in the restriction group) can approve it.',
  'Q-16': 'The system must not allow saving a contract with the same priority.',
  'Q-24': 'Do not check Rate check for now.',
};

// Round 2 - business scenarios (shot = which screenshot shows the screen the question is about)
Q.push(
  // ----- supplier -----
  { id: 'Q-27', shot: 'Q-02', area: 'Supplier name', q: 'May two suppliers have the same name in DIFFERENT cities (e.g. "Hilton" Dubai and "Hilton" Abu Dhabi)? Is the name check case-insensitive and does it ignore spaces?', seen: 'BUG-43: the exact same name is saved twice.', tests: 'Same name same city / other city / other case / extra spaces', opts: 'a) Unique per city  b) Unique overall' },
  { id: 'Q-28', shot: 'Q-02', area: 'Supplier city', q: 'Can the city of an existing supplier be changed? If yes, does the code (DXB-..) change?', seen: 'City is editable in Edit mode; the code is locked.', tests: 'Change city -> code kept / renumbered', opts: '' },
  { id: 'Q-29', shot: 'Q-01', area: 'Blocking a supplier', q: 'When an Approved supplier with approved contracts and future bookings is Blocked: what happens to its contracts (deactivated / Provisional?) and to existing bookings?', seen: 'Blocking is just a status button; contracts stay as they are.', tests: 'Block with live contracts -> contracts / bookings / Product Search', opts: '' },
  { id: 'Q-30', shot: 'Q-01', area: 'Unblocking', q: 'Can a Blocked supplier be set back to On hold / Approved? By whom? What must be checked first?', seen: 'All 3 status buttons are offered on a Blocked supplier.', tests: 'Unblock flow and rights', opts: '' },
  { id: 'Q-31', shot: 'Q-01', area: 'Approving a supplier', q: 'Who may set a supplier to Approved (restriction group?) and what must be complete first (primary contact, bank account, documents, tax number)?', seen: 'Any status can be chosen freely in Edit.', tests: 'Approve incomplete supplier -> refused', opts: '' },
  { id: 'Q-32', shot: 'Q-07', area: 'Default currency', q: 'Can the default currency be changed to another currency of the supplier? Can the default currency ever be removed?', seen: '"Remove AED" is disabled because AED is the default; "Default currency" button is disabled.', tests: 'Change default, remove default', opts: '' },
  { id: 'Q-33', shot: 'Q-07', area: 'Remove a currency', q: 'Removing a currency that NO contract uses but that has a bank account: allowed? What happens to the bank account?', seen: 'Each currency row has bank accounts and a Remove button.', tests: 'Remove currency with bank account', opts: '' },
  { id: 'Q-34', shot: 'Q-07', area: 'Branch / department', q: 'What are Branch and Department on a currency row used for? Can the same currency be added twice for different branches?', seen: 'Add currency has optional Branch and Department; a currency already on the supplier is not offered again.', tests: 'Same currency for 2 branches', opts: '' },
  { id: 'Q-35', shot: 'Q-04', area: 'Contact details', q: 'Are email / phone required for a contact? Phone format? May the same email be used by contacts of different suppliers?', seen: 'Only Name and Role are required; email must look like an email.', tests: 'Phone format, duplicate email', opts: '' },
  { id: 'Q-36', shot: 'Q-05', area: 'Addresses', q: 'Which address fields are required? Should the correspondence address be copyable from the primary address?', seen: 'Contacts tab: Primary address and Correspondence address, read-only until Edit.', tests: 'Required address fields, copy', opts: '' },
  { id: 'Q-37', shot: 'Q-03', area: 'Supplier search', q: 'Should the supplier list also search by city, contact email or phone? Should Blocked suppliers be hidden by default?', seen: 'List searches Name and Code, filters Status (default All).', tests: 'Extra search fields, default filter', opts: '' },
  { id: 'Q-38', shot: 'Q-03', area: 'Audit', q: 'Which supplier changes must appear in Audit history (status, currency, bank account, contacts, contracts)? Should old and new values be shown?', seen: 'Audit history opens from the list.', tests: 'Each change -> audit entry', opts: '' },
  // ----- contract -----
  { id: 'Q-39', shot: 'Q-16', area: 'Same priority - scope', q: 'The same priority is not allowed (your Q-16 answer). Does that apply only when dates OVERLAP? Also to Draft / inactive contracts? Also across different markets, base plans or room categories?', seen: 'Priority is a free number; help says the lower number wins.', tests: 'Same priority: overlapping / not overlapping / inactive / other market / other base plan', opts: '' },
  { id: 'Q-40', shot: 'Q-16', area: 'Priority fallback', q: 'If the winning (lower number) contract has no price for a room, does the next contract price that room?', seen: '', tests: 'Two contracts, partial prices', opts: '' },
  { id: 'Q-41', shot: 'Q-17', area: 'Contract name', q: 'Must the contract name be unique per supplier / per product?', seen: 'We could save contracts with any name.', tests: 'Duplicate contract name', opts: '' },
  { id: 'Q-42', shot: 'Q-18', area: 'Seasons', q: 'May seasons overlap? May they leave gaps inside the contract validity? May a season go outside the contract dates?', seen: 'Add season defaults to the contract dates.', tests: 'Overlap / gap / outside validity', opts: '' },
  { id: 'Q-43', shot: 'Q-18', area: 'Prices', q: 'Is a price of 0 allowed? Maximum price? How many decimals? Can Double be cheaper than Single?', seen: 'Prices show 2 decimals ("650.00").', tests: 'Price boundaries', opts: '' },
  { id: 'Q-44', shot: 'Q-18', area: 'Min / max stay', q: 'Season min stay larger than max stay must be refused? Min stay 0 allowed?', seen: 'Season: Min stay "Any length", Max stay "No limit".', tests: 'Min > max, 0, negative', opts: '' },
  { id: 'Q-45', shot: 'Q-17', area: 'Markets', q: 'A contract for "Asian Market" only: may a booking from Default Market use it? What does "All markets" include - also markets added later?', seen: 'Markets: Default Market, Asian Market (empty = All markets).', tests: 'Market restriction', opts: '' },
  { id: 'Q-46', shot: 'Q-15', area: 'Book before', q: '"Book before 3 days" = the booking must be made at least 3 days before arrival? Hours unit as well?', seen: 'Book before: number + Days.', tests: 'Booking inside / outside the window', opts: '' },
  { id: 'Q-47', shot: 'Q-17', area: 'Rate for', q: 'What do the "Rate for" options mean (Both / ...)? B2B agents vs B2C website?', seen: 'Rate for defaults to "Both".', tests: 'Rate visible per channel', opts: '' },
  { id: 'Q-48', shot: 'Q-19', area: 'Meal supplements', q: 'Meal supplement adult/child/infant prices: required? Can a supplement be for a board LOWER than the base plan (e.g. Room only on a BB contract)?', seen: 'Marina Bay: HB 140/70, FB 260/130 on a BB contract.', tests: 'Supplement validation', opts: '' },
  { id: 'Q-49', shot: 'Q-19', area: 'Extra bed', q: 'Extra bed / child bed / infant bed supplements: only for room occupancies with "+bed"? Required when the occupancy allows a bed?', seen: 'Other supplements: Extra bed, Extra child bed, Extra infant bed.', tests: 'Bed supplements per occupancy', opts: '' },
  { id: 'Q-50', shot: 'Q-14', area: 'Contract file', q: 'Is the signed contract file required before approval? File types (PDF / image) and size limit?', seen: 'Contract file: "Upload the signed contract - Click or drag a PDF or image here".', tests: 'Upload types/size, approval without file', opts: '' },
  { id: 'Q-51', shot: 'Q-14', area: 'Back to draft', q: 'Who may press "Back to draft" on an approved contract? What happens to bookings already made on it?', seen: 'Approved contracts have a "Back to draft" button and an undo icon in the list.', tests: 'Back to draft rights and effect', opts: '' },
  { id: 'Q-52', shot: 'Q-26', area: 'Copy / roll over', q: 'What does "Copy or roll over" create: a Draft copy with the same prices? New dates +1 year? New name/code?', seen: 'Each contract row has "Copy or roll over".', tests: 'Copy and roll over results', opts: '' },
  { id: 'Q-53', shot: 'Q-26', area: 'Expired contract', q: 'When Valid to has passed: does the status change (Expired)? Can it still be edited or re-activated?', seen: 'Validity column shows "Current".', tests: 'Expired contract behaviour', opts: '' },
  { id: 'Q-54', shot: 'Q-26', area: 'Deactivate contract', q: 'May a contract with future bookings be deactivated? Is a reason / confirmation required?', seen: 'The Active switch is in the list.', tests: 'Deactivate with bookings', opts: '' },
  { id: 'Q-55', shot: 'Q-06', area: 'Provisional status', q: 'Besides removing a currency, what else moves a contract to Provisional? How does it get back to Approved (re-approve, or add the currency again)?', seen: 'Your Q-06 answer introduces "Provisional"; today only Draft / Approved are shown.', tests: 'Provisional -> Approved flow', opts: '' },
  // ----- allotment / promotion -----
  { id: 'Q-56', shot: 'Q-21', area: 'Allotment dates', q: 'May an allotment run outside the contract validity? May an allotment exist for a room that no contract prices?', seen: 'Allotment has its own Valid from / to; "Sell at contract" = Any approved contract.', tests: 'Allotment outside contract / room without contract', opts: '' },
  { id: 'Q-57', shot: 'Q-21', area: 'Per day vs Shared pool', q: 'Difference between Per day and Shared pool? When release days pass, do unsold rooms go back to the hotel automatically (Auto release)?', seen: 'Per day / Shared pool; Auto release Yes; Release 7 days.', tests: 'Release and pool behaviour', opts: '' },
  { id: 'Q-58', shot: 'Q-21', area: 'Two allotments', q: 'May two active allotments cover the same room and dates? Which one is used first?', seen: '', tests: 'Overlapping allotments', opts: '' },
  { id: 'Q-59', shot: 'Q-22', area: 'Promotion scope', q: 'May a promotion apply to an inactive or draft contract? May its stay dates go outside the contract dates?', seen: 'Applies to contracts: "All active contracts" by default.', tests: 'Promotion on inactive contract / outside dates', opts: '' },
  { id: 'Q-60', shot: 'Q-22', area: 'Promotion approval', q: 'Do promotions need approval like contracts? Who approves? Does editing an approved promotion send it back to Draft?', seen: 'Marina Bay\'s promotion shows status Approved.', tests: 'Promotion approval flow', opts: '' },
  { id: 'Q-61', shot: 'Q-22', area: 'Blackout dates', q: 'Blackout dates = the promotion does not apply to stays on those dates (or to bookings made on those dates)?', seen: 'Blackout dates: None, Add blackout.', tests: 'Blackout behaviour', opts: '' },
  // ----- other products / rights -----
  { id: 'Q-62', shot: 'Q-11', area: 'Other products', q: 'Excursion, Private transfer and the other services have their own Contract / Allotment / Promotions screens. Should they be tested the same way as Hotel? Any differences in rules?', seen: 'Testing season 3 offers Hotel, Excursion, Private transfer.', tests: 'Same suite for Excursion and Transfer', opts: 'a) Yes, same rules  b) Differences: ...' },
  { id: 'Q-63', shot: 'Q-13', area: 'Restriction groups (for Q-13)', q: 'To test who may approve, can you give a second test user WITHOUT contract-modify rights (and tell me where restriction groups are set)?', seen: 'All tests run as one user (sahil).', tests: 'Approve / edit refused for a user without rights', opts: 'Please share user name; password via .env only' },
);

async function main() {
  const shots = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter(f => f.endsWith('.png')) : [];
  const wb = new ExcelJS.Workbook();
  const font = { name: 'Arial', size: 10 };
  const head = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  const answerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };

  const ws = wb.addWorksheet('Questions', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 18 }, { width: 46 }, { width: 38 }, { width: 30 }, { width: 28 }, { width: 40 }, { width: 60 }, { width: 28 }];
  ws.mergeCells('A1:I1');
  ws.getCell('A1').value = 'ERP (Pilot) - Supplier module: questions for the product owner';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `Date: ${DATE}   |   Please write your answer in the yellow "Your answer" column. Each answer becomes new automated test scenarios.`;
  ws.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const headers = ['ID', 'Area', 'Question', 'What we saw', 'Tests the answer will drive', 'Possible answers', 'Your answer', 'Screenshot', 'Screenshot file'];
  const hr = ws.getRow(4);
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = head; c.fill = headFill; c.border = border; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  hr.height = 22;

  Q.forEach((q, i) => {
    const r = ws.getRow(5 + i);
    const file = shots.find(f => f.startsWith((q.shot ?? q.id) + '-'));
    r.values = [q.id, q.area, q.q, q.seen, q.tests, q.opts, ANSWERS[q.id] ?? '', file ? '' : 'no screenshot', file ?? '-'];
    r.eachCell({ includeEmpty: true }, (c, col) => { c.font = font; c.border = border; c.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 ? 'center' : 'left' }; });
    r.getCell(1).font = { ...font, bold: true };
    r.getCell(7).fill = answerFill;
    if (file) {
      r.height = 200;
      const img = wb.addImage({ filename: path.join(SHOTS, file), extension: 'png' });
      ws.addImage(img, { tl: { col: 7.05, row: 4 + i + 0.05 }, ext: { width: 410, height: 260 }, editAs: 'oneCell' });
      r.getCell(9).value = { text: file, hyperlink: `screenshots/${file}` };
      r.getCell(9).font = { ...font, color: { argb: 'FF0563C1' }, underline: true };
    } else r.height = 90;
  });

  const out = path.join(OUT_DIR, 'Supplier-Questions.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`written ${out}: ${Q.length} questions, ${Q.filter(q => shots.some(f => f.startsWith((q.shot ?? q.id) + '-'))).length} with screenshots, ${Object.keys(ANSWERS).length} answered`);
}
main().catch(e => { console.error(e); process.exit(1); });
