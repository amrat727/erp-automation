/*
 * Builds the bug report Excel file from the list below + screenshots/bugs/*.png
 *   Run:  npm run bug-report
 *   Out:  reports/ERP-Bug-Report.xlsx
 * To add a bug: add one entry to BUGS (and its screenshot via tests/core/bug-evidence.spec.ts).
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'screenshots', 'bugs');
const OUT_DIR = path.join(ROOT, 'reports', 'ERP-Bug-Report');   // xlsx + screenshots/ (zip this folder to share)
const REPORTED_BY = 'QA Automation (Playwright)';
const DATE = '16-Nov-2026';
const ENV = 'https://erp.nexgenpilot.com  |  company "sb" (Sandbox)  |  user sahil  |  app v1.0.2  |  Chrome';

// sev: High = data wrong / lost, Medium = feature missing or misleading, Low = wording / cosmetic
const BUGS = [
  { id: 'BUG-01', mod: 'Login', screen: 'Login', type: 'Bug', sev: 'Medium',
    title: 'Spaces around Company code / Username are not trimmed',
    steps: '1. Open /login\n2. Enter "  sb  " and "  sahil  " (spaces before/after) + correct password\n3. Click Sign in',
    expected: 'Spaces are ignored and the user is logged in', actual: '"Invalid credentials" - login fails', tc: 'TC-LOGIN-31' },
  { id: 'BUG-02', mod: 'Login', screen: 'Login', type: 'Bug', sev: 'Low',
    title: 'Logged-in user opening /login sees the login form',
    steps: '1. Log in\n2. Open https://erp.nexgenpilot.com/login', expected: 'User is redirected to the dashboard', actual: 'Login form is shown again', tc: 'TC-LOGIN-35' },
  { id: 'BUG-03', mod: 'Core > Region', screen: 'Country, State, City, Market, Landmark', type: 'Grammar', sev: 'Low',
    title: 'Deactivate popup says "deactive" (not an English word)',
    steps: '1. Core > Region > Countries\n2. Click the Active switch of India\n3. Read the popup (then Cancel)',
    expected: '"This will mark the country as inactive."', actual: '"This will mark the country as deactive."', tc: 'TC-RGN-*-14, TC-CTRY-29' },
  { id: 'BUG-04', mod: 'Core > Region / Product', screen: 'All list screens except Province', type: 'Grammar', sev: 'Low',
    title: 'Active filter option is "Deactive"',
    steps: '1. Open any list screen (e.g. Countries)\n2. Open the Active filter in the table header', expected: 'Options: All / Active / Inactive', actual: 'Options: All / Active / Deactive', tc: 'TC-CTRY-30' },
  { id: 'BUG-05', mod: 'Core > Region', screen: 'Province', type: 'Inconsistency', sev: 'Low',
    title: 'Province filter says "Inactive" while all other screens say "Deactive"',
    steps: '1. Core > Region > Province\n2. Open the Active filter', expected: 'Same wording on every screen', actual: 'Province: "Inactive", others: "Deactive"', tc: 'TC-RGN-Province-05' },
  { id: 'BUG-06', mod: 'Core > Region', screen: 'Province', type: 'Inconsistency', sev: 'Low',
    title: 'Popup title "Deactivate Province?" uses a capital P',
    steps: '1. Core > Region > Province\n2. Click the switch of an active province', expected: '"Deactivate province?" (like "Deactivate state?")', actual: '"Deactivate Province?"', tc: 'TC-RGN-Province-12',
    noShot: 'No active Province exists right now to open the popup on (seen during the add/deactivate flow).' },
  { id: 'BUG-07', mod: 'Core > Region', screen: 'Landmark', type: 'Inconsistency', sev: 'Low',
    title: 'Landmark popup text differs ("mark it as deactive")',
    steps: '1. Core > Region > Landmark\n2. Click the switch of "DXB Terminal 1"', expected: '"This will mark the landmark as inactive."', actual: '"This will mark it as deactive."', tc: 'TC-RGN-Landmark-13' },
  { id: 'BUG-08', mod: 'Core > Region', screen: 'Airport', type: 'Inconsistency', sev: 'Low',
    title: 'Airport popup title uses the airport CODE and completely different text',
    steps: '1. Core > Region > Airport\n2. Click the switch of "Aalborg Airport"', expected: '"Deactivate airport?" + standard sentence', actual: '"Deactivate AAL?" + "It stops appearing in this company\'s Origin/Destination pickers..."', tc: 'TC-RGN-Airport-12/13' },
  { id: 'BUG-09', mod: 'Core > Region', screen: 'State, City, Market, Landmark, Province', type: 'Bug', sev: 'High',
    title: 'Name field silently removes digits',
    steps: '1. Core > Region > State > Add State\n2. Type "Zone 2 North-1" in Name', expected: 'Name keeps "Zone 2 North-1" (Desk Location keeps digits)', actual: 'Field shows "Zone  North-" - digits removed with no message', tc: 'TC-RGN-*-16' },
  { id: 'BUG-10', mod: 'Core > Region', screen: 'Market', type: 'UX', sev: 'Medium',
    title: 'Countries is required but has no * on the label',
    steps: '1. Core > Region > Market > Add Market\n2. Enter only Name, click Save', expected: 'Required fields are marked with *', actual: 'Save is refused because Countries is empty, but the label has no *', tc: 'TC-MARKET-01' },
  { id: 'BUG-11', mod: 'Core > Region', screen: 'State (also City, Landmark, Province)', type: 'UX', sev: 'Low',
    title: 'Missing Country shown only as a banner - the field is not marked red like Name',
    steps: '1. Core > Region > State > Add State\n2. Enter Name only, click Save', expected: 'Country field turns red with "Country is required" under it', actual: 'Banner "Please select a country." at the top; field not highlighted', tc: 'TC-RGN-State-17' },
  { id: 'BUG-12', mod: 'Core > Region', screen: 'Desk Location', type: 'Inconsistency', sev: 'Medium',
    title: 'Desk Location has no Audit history and no Active filter',
    steps: '1. Core > Region > Desk Location', expected: 'Same toolbar/table as other screens (Audit history, Active filter)', actual: 'Both are missing; empty message is also different ("No desk locations yet.")', tc: 'TC-RGN-DeskLocation-03/05/06' },
  { id: 'BUG-13', mod: 'Core > Region', screen: 'Airport', type: 'Inconsistency', sev: 'Medium',
    title: 'Airport has no "Add Airport" button (and no Edit)',
    steps: '1. Core > Region > Airport', expected: 'Add button like every other screen (or confirm it is intentional)', actual: 'No Add button; clicking a row does nothing', tc: 'TC-RGN-Airport-02/11' },
  { id: 'BUG-14', mod: 'Core > Region', screen: 'Country', type: 'Bug', sev: 'Medium',
    title: 'Add Country list still offers countries that are already added',
    steps: '1. Core > Region > Country > Add Country\n2. Type "India" (already exists)', expected: 'Already-added countries are not offered', actual: '"India" is offered; saving gives only a generic error', tc: 'TC-CTRY-24' },
  { id: 'BUG-15', mod: 'Core > Region', screen: 'Airport', type: 'Data', sev: 'Low',
    title: 'Airport data contains "[Duplicate] Giebelstadt Army Air Field"',
    steps: '1. Core > Region > Airport\n2. Search "Giebelstadt"', expected: 'Clean master data', actual: 'A record literally named "[Duplicate] ..."', tc: '-' },
  { id: 'BUG-16', mod: 'Core > Region', screen: 'Audit history (State, City, Market)', type: 'Inconsistency', sev: 'Low',
    title: 'Audit history shows "sahil" on old entries and "Sahil Chauhan" on new ones',
    steps: '1. Core > Region > State > Audit history\n2. Scroll to entries before 11 Nov', expected: 'The same user is always shown the same way', actual: 'Old: "sahil", new: "Sahil Chauhan"', tc: 'TC-*-14' },
  { id: 'BUG-17', mod: 'Core > Region', screen: 'Country', type: 'Inconsistency', sev: 'Medium',
    title: 'Country has no Edit - clicking a row does nothing',
    steps: '1. Core > Region > Country\n2. Click on "India"', expected: '"Edit Country" opens (as on State, City...)', actual: 'Nothing happens', tc: 'TC-RGN-Country-11' },
  { id: 'BUG-18', mod: 'Core > Product', screen: 'Product Type, Supplement', type: 'Inconsistency', sev: 'Low',
    title: 'Popup says "This will mark it as deactive." (non-standard + grammar)',
    steps: '1. Core > Product > Product Type\n2. Click the switch of "Hotel" (then Cancel)', expected: '"This will mark the product type as inactive."', actual: '"This will mark it as deactive."', tc: 'TC-PRD-ProductType-13, TC-PRD-Supplement-13' },
  { id: 'BUG-19', mod: 'Core > Product', screen: 'View Type, Room Category, Amenity', type: 'Inconsistency', sev: 'Low',
    title: 'Popup uses a different sentence ("It stops appearing in pickers...")',
    steps: '1. Core > Product > View Type\n2. Click the switch of "Park Facing"', expected: 'One standard sentence on every screen', actual: '"It stops appearing in pickers. Records already using it are unaffected."', tc: 'TC-PRD-ViewType-13 / RoomCategory-13 / Amenity-13' },
  { id: 'BUG-20', mod: 'Core > Product', screen: 'Room Type', type: 'Inconsistency', sev: 'Low',
    title: 'Room Type popup uses yet another sentence',
    steps: '1. Core > Product > Room Type\n2. Click the switch of "Bunk"', expected: 'One standard sentence on every screen', actual: '"It stops being offered for new product rooms. Products that already use it keep it."', tc: 'TC-PRD-RoomType-13' },
  { id: 'BUG-21', mod: 'Core > Product', screen: 'Menu', type: 'Inconsistency', sev: 'Low',
    title: 'Menu items are partly plural, partly singular',
    steps: '1. Open the menu Core > Product', expected: 'Same style for all items', actual: '"Supplements", "Allotments", "Addons", "Amenities" vs "Product Type", "Room Type"...', tc: 'TC-PRD-*-01' },
  { id: 'BUG-22', mod: 'Core > Product', screen: 'Product Type, Product Class, Supplement, Allotment, Addon', type: 'Bug', sev: 'High',
    title: 'Name field silently removes digits',
    steps: '1. Core > Product > Product Type > Add Product Type\n2. Type "Zone 2 North-1" in Name', expected: 'Name keeps "Zone 2 North-1" (View Type, Room Type, Amenity keep digits)', actual: 'Field shows "Zone  North-"', tc: 'TC-PRD-*-16' },
  { id: 'BUG-23', mod: 'Core > Product', screen: 'Product Type (also Product Class, Addon)', type: 'UX', sev: 'Medium',
    title: 'Required "Product" shows no error message when empty',
    steps: '1. Core > Product > Product Type > Add Product Type\n2. Click Save with an empty form', expected: '"Product is required" under the field (like "Name is required")', actual: 'Only Name shows an error; Product* shows nothing', tc: 'TC-PRD-ProductType-17' },
  { id: 'BUG-24', mod: 'Core > Product', screen: 'Supplement', type: 'Inconsistency', sev: 'Medium',
    title: 'Product Type gets no error while Sequence does (same form)',
    steps: '1. Core > Product > Supplements > Add Supplement\n2. Click Save with an empty form', expected: 'All 3 required fields show "... is required"', actual: 'Name and Sequence show errors; Product Type* shows nothing', tc: 'TC-PRD-Supplement-17' },
  { id: 'BUG-25', mod: 'Core > Product', screen: 'Product Type, Product Class, Supplement, Allotment, Addon', type: 'Bug', sev: 'High',
    title: 'Duplicate name is accepted when typed with spaces around it',
    steps: '1. Add a Product Type "ABC"\n2. Add another Product Type "   ABC   " (spaces before/after)', expected: 'Rejected: name already exists', actual: 'Saved (201) - two identical names in the list', tc: 'TC-PRODUCTTYPE-06 (and the other 4 screens)' },
  { id: 'BUG-26', mod: 'Core > Product', screen: 'Product Type, Product Class, Supplement, Allotment, Addon', type: 'Bug', sev: 'High',
    title: 'Name is saved with the spaces around it, and & ( ) are silently removed',
    steps: '1. Add a Product Type named "   Edge & Co (Test)   "\n2. Open it again (Edit)', expected: 'Saved as "Edge & Co (Test)"', actual: 'Saved as "   Edge  Co Test   " - spaces kept, & ( ) removed', tc: 'TC-PRODUCTTYPE-08 (and the other 4 screens)' },
  { id: 'BUG-27', mod: 'Core > Region / Product', screen: 'List screens (seen on Amenities)', type: 'Bug', sev: 'Medium',
    title: 'Search with spaces before/after the text finds nothing',
    steps: '1. Core > Product > Amenities\n2. Type "  Air Conditioning  " in the Name search', expected: '"Air Conditioning" is found', actual: '"There are no records in Amenity"', tc: 'TC-*-23' },
  { id: 'BUG-28', mod: 'Core > Region', screen: 'Country (all switch screens)', type: 'UX', sev: 'Medium',
    title: 'Re-activating a record has no confirmation popup (deactivating has one)',
    steps: '1. Click the switch of a deactivated record', expected: 'A confirmation like "Activate country?"', actual: 'Record is activated immediately - easy to do by mistake', tc: 'TC-CTRY-27',
    noShot: 'Not captured on purpose: it would re-activate real data.' },
  { id: 'BUG-29', mod: 'Core > Region / Product', screen: 'All Add/Edit forms', type: 'Accessibility', sev: 'Low',
    title: 'Form labels are not linked to their inputs',
    steps: '1. Open any Add dialog\n2. Inspect the Name label/input (DevTools)', expected: '<label for="..."> linked to the input (screen readers announce it)', actual: 'Label text is not connected to the input', tc: '(found while automating)',
    noShot: 'Code-level issue - visible only in DevTools.' },
  // ---------- added 13-Nov-2026: Core > Application, Resource, Organization, Accounts, System ----------
  { id: 'BUG-30', mod: 'Core > Organization', screen: 'Department', type: 'Bug', sev: 'Low',
    title: 'Department deactivate popup talks about the BRANCH',
    steps: '1. Core > Organization > Department\n2. Click the switch of "Reservations" (then Cancel)', expected: '"This will mark the department as inactive."', actual: '"This will mark the branch as deactive."', tc: 'TC-ORG-Department-13' },
  { id: 'BUG-31', mod: 'Core > Application / Accounts', screen: 'Language, Account Group', type: 'Bug', sev: 'Medium',
    title: 'Empty form is sent to the server - no "Name is required" check in the screen',
    steps: '1. Core > Application > Language > Add Language\n2. Click Save without typing anything', expected: '"Name is required" is shown and nothing is sent', actual: 'The empty form is sent to the server (no message under Name)', tc: 'TC-APP-Language-10, TC-ACC-AccountGroup-10' },
  { id: 'BUG-32', mod: 'Core > Accounts', screen: 'Tax', type: 'Inconsistency', sev: 'Low',
    title: 'Empty Name message is "Enter a name." (all other screens: "Name is required")',
    steps: '1. Core > Accounts > Configuration > Tax > Add Tax\n2. Click Save with an empty form', expected: '"Name is required"', actual: '"Enter a name."', tc: 'TC-ACC-Tax-10' },
  { id: 'BUG-33', mod: 'Core > Accounts', screen: 'Tax', type: 'Inconsistency', sev: 'Low',
    title: 'Tax Name allows fewer than 150 characters (150 everywhere else)',
    steps: '1. Core > Accounts > Configuration > Tax > Add Tax\n2. Type 150 characters in Name', expected: 'All 150 characters are kept (same limit as other screens - confirmed by product owner)', actual: 'The field stops at 100 (see screenshot file name)', tc: 'TC-ACC-Tax-19' },
  { id: 'BUG-34', mod: 'Core > System', screen: 'User', type: 'Bug', sev: 'High',
    title: 'No user can be created: Restriction Group is required but the list is empty',
    steps: '1. Core > System > User > Add User\n2. Click Save\n3. Open the Restriction Group dropdown', expected: 'A user can be created (Help Center: a user without a group gets the company\'s full limit) - or groups exist to pick', actual: '"Restriction Group is required" and the dropdown has nothing to pick', tc: 'TC-USR-03, TC-RG-04' },
  { id: 'BUG-35', mod: 'Core > System', screen: 'Restriction Group', type: 'Inconsistency', sev: 'Medium',
    title: 'Restriction Groups has no "Audit history" (access rights changes are not traceable)',
    steps: '1. Core > System > Restriction Group', expected: '"Audit history" button like every other list screen', actual: 'Only "Columns" - no Audit history', tc: 'TC-RG-02' },
  { id: 'BUG-36', mod: 'Core > Application', screen: 'Role', type: 'Inconsistency', sev: 'Low',
    title: 'Role screen: singular heading and URL /contacttype',
    steps: '1. Core > Application > Role\n2. Look at the heading and the address bar', expected: 'Heading "Roles" and URL /roles (like /currency -> "Currencies")', actual: 'Heading "Role", URL /contacttype (same singular heading on Language, Status, Account Group, Tax)', tc: 'TC-APP-Role-01' },
  { id: 'BUG-37', mod: 'Core > Application', screen: 'Flex 1-10', type: 'Inconsistency', sev: 'Low',
    title: 'Menu says "Flex1" but the page heading says "Flex 1"',
    steps: '1. Core > Application > Flex > Flex1', expected: 'Same name in menu and heading', actual: 'Menu "Flex1", heading "Flex 1" (all 10 items)', tc: 'TC-FLEX-12' },
  { id: 'BUG-38', mod: 'Core > Accounts', screen: 'Chart of Accounts, Account Group, Tax, Tax Detail', type: 'Inconsistency', sev: 'Low',
    title: 'Active filter says "Inactive" while Branch, Department, Exchange Rate... say "Deactive"',
    steps: '1. Core > Accounts > Configuration > Chart of Accounts\n2. Open the Active filter', expected: 'Same word on every screen (preferably "Inactive")', actual: '"Inactive" here, "Deactive" on other screens', tc: 'TC-ACC-*-05' },
  { id: 'BUG-39', mod: 'Core > Accounts', screen: 'Refund Payouts', type: 'Bug', sev: 'Medium',
    title: 'Refund Payouts shows no list and no empty message',
    steps: '1. Core > Accounts > Transactions > Refund Payouts\n2. Wait 15 seconds', expected: 'A table of refund payouts, or a clear message such as "There are no refunds to pay out"', actual: 'Only the heading and the Show filter ("To pay out / in progress") - no table and no "nothing to pay out" message, so the user cannot tell if it is empty or still loading. Takes 15s+ to show even this.', tc: 'TC-REF-01' },
  { id: 'BUG-40', mod: 'Core > Resource', screen: 'Resource Type, Personnel, Asset', type: 'Inconsistency', sev: 'Low',
    title: 'Popup says "This will mark it as deactive." (non-standard + grammar)',
    steps: '1. Core > Resource > Resource Types\n2. Click the switch of "Driver" (then Cancel)', expected: '"This will mark the resource type as inactive."', actual: '"This will mark it as deactive."', tc: 'TC-RES-*-13' },
  { id: 'BUG-41', mod: 'Core > Resource', screen: 'Personnel', type: 'UX', sev: 'Medium',
    title: 'Required "Personnel Type" shows no error message when empty',
    steps: '1. Core > Resource > Personnel > Add Personnel\n2. Click Save with an empty form', expected: '"Personnel Type is required" (like "Name is required")', actual: 'Only Name shows an error', tc: 'TC-RES-Personnel-17' },
  { id: 'BUG-42', mod: 'Core > Accounts', screen: 'Tax Detail', type: 'Bug', sev: 'Medium',
    title: 'Empty Tax Detail form is sent to the server',
    steps: '1. Core > Accounts > Configuration > Tax Detail > Add Tax Detail\n2. Click Save with an empty form', expected: 'Required fields are checked in the screen first', actual: 'The empty form is sent to the server', tc: 'TC-TXD-02' },
  { id: 'BUG-43', mod: 'Supplier', screen: 'Add supplier', type: 'Bug', sev: 'High',
    title: 'A second supplier with the same name is saved (duplicate names allowed)',
    steps: '1. Supplier > Add supplier\n2. Name "QA Auto Supplier X", city Dubai, currency AED > Create supplier\n3. Repeat step 2 with exactly the same name (also tried: same name in CAPITALS, and with spaces around it)',
    expected: 'Second save is refused with a "supplier already exists" message', actual: 'Both are saved with different codes (DXB-008 and DXB-009) - the list shows two suppliers with the same name', tc: 'TC-SUPC-12 (x3)' },
  { id: 'BUG-44', mod: 'Supplier', screen: 'Add supplier', type: 'Inconsistency', sev: 'Low',
    title: 'Empty City says "Choose a city." while the other fields say "... is required"',
    steps: '1. Supplier > Add supplier\n2. Click Create supplier with an empty form', expected: '"City is required" (like "Name is required", "Default currency is required")', actual: '"Choose a city."', tc: 'TC-SUP-24' },
  { id: 'BUG-45', mod: 'Supplier', screen: 'Supplier list / Overview', type: 'Inconsistency', sev: 'Low',
    title: 'Status is spelled "On hold" in the list but "On Hold" on the supplier page',
    steps: '1. Supplier > open "Testing season 3"\n2. Click Edit and read the status buttons; compare with the list and the status badge', expected: 'Same spelling everywhere ("On hold")', actual: 'List, filter and badge: "On hold"; status button in edit mode: "On Hold"', tc: 'TC-SUP-44' },
  { id: 'BUG-46', mod: 'Supplier', screen: 'Financials > Bank account', type: 'Bug', sev: 'Medium',
    title: 'SWIFT code of 3 characters is sent to the server (no 8 or 11 characters check)',
    steps: '1. Supplier > "Testing season 3" > Financials > Add bank account\n2. Holder "QA Auto Holder", bank "QA Auto Bank", IBAN AE070331234567890123456, SWIFT "ABC"\n3. Click Save',
    expected: 'The screen refuses it: SWIFT must be 8 or 11 characters (the field hint says "8 or 11 characters")', actual: 'The save request is sent with "ABC" and no message appears (the red banner in the screenshot is only because the test blocks the save)', tc: 'TC-SUP-54' },
  { id: 'BUG-47', mod: 'Supplier', screen: 'Supplier list', type: 'Bug', sev: 'Low',
    title: 'Name search does not ignore spaces before/after the text',
    steps: '1. Supplier list\n2. Type "  Marina Bay Hotel  " (spaces around) in the Name search', expected: 'Marina Bay Hotel is found (spaces ignored, like the other list screens)', actual: '"There are no records in Supplier"', tc: 'TC-SUP-09' },
  { id: 'BUG-48', mod: 'Supplier - Contract', screen: 'Products > Hotel > Contract > Add contract', type: 'Bug', sev: 'High',
    title: 'A contract is saved without the required Currency',
    steps: '1. Supplier "Testing season 3" > Products > Hotel > Contract > Add contract\n2. Contract name "QA Auto Contract no currency", Base plan "Bed and breakfast", leave Currency empty\n3. Click Save',
    expected: 'Currency (marked *) is flagged: "1 problem to fix", nothing is sent', actual: 'No problem is shown and the contract is sent to the server without a currency (request has no currencyId). The red banner is only because the test blocks the save', tc: 'TC-CON-16' },
  { id: 'BUG-49', mod: 'Supplier - Contract', screen: 'Products > Hotel > Contract > Add contract', type: 'Bug', sev: 'Low',
    title: 'A negative Priority (-5) is accepted',
    steps: '1. Add contract as in BUG-48, choose Currency AED\n2. Priority: -5\n3. Click Save', expected: 'Refused: the Priority field has a minimum of 0', actual: 'The contract is sent with "priority": -5', tc: 'TC-CON-20' },
  { id: 'BUG-50', mod: 'Supplier - Contract', screen: 'Contracts list (menu Contracts)', type: 'Usability', sev: 'Low',
    title: '"Valid" column has no year - a one-year contract looks like it ends before it starts',
    steps: '1. Menu Contracts\n2. Read the Valid column of "Connaught Demo 2026-27 BAR"',
    expected: '"15 Oct 2026 – 14 Oct 2027" (as on the supplier\'s Contract tab)', actual: '"15 Oct – 14 Oct" (same for every contract)', tc: 'TC-CON-65' },
  // ----- business rules confirmed by the product owner on 16-Nov-2026 (supplier-rules.spec.ts) -----
  { id: 'BUG-51', mod: 'Supplier', screen: 'Supplier > Overview (Blocked)', type: 'Business rule', sev: 'High',
    title: 'A Blocked supplier can still be edited and saved',
    steps: '1. Open a supplier with status Blocked (e.g. "QA Auto Supplier RNMKVV evidence", DXB-009)\n2. Click Edit, change the name, click Save',
    expected: 'Blocked = deactivated: no detail can be saved (Edit not offered, or the save is refused)', actual: 'The change is saved (PUT /suppliers/27 -> 204)', tc: 'TC-RULE-01' },
  { id: 'BUG-52', mod: 'Supplier', screen: 'Supplier > Contacts (Blocked)', type: 'Business rule', sev: 'High',
    title: 'A contact can be added to a Blocked supplier',
    steps: '1. Blocked supplier > Contacts > Add contact\n2. Name "QA Auto Contact ... blocked", role Admin > Save', expected: 'Refused - no new detail on a blocked supplier', actual: 'The contact is saved (201) and shown as Primary', tc: 'TC-RULE-02' },
  { id: 'BUG-53', mod: 'Supplier', screen: 'Supplier > Financials (Blocked)', type: 'Business rule', sev: 'High',
    title: 'A currency can be added to a Blocked supplier',
    steps: '1. Blocked supplier > Financials > Add currency\n2. Currency USD > Save', expected: 'Refused - no new detail on a blocked supplier', actual: 'USD is saved (204). The test removed it again', tc: 'TC-RULE-03' },
  { id: 'BUG-54', mod: 'Supplier - Contract', screen: 'Products > Hotel > Contract', type: 'Business rule', sev: 'High',
    title: 'Two contracts with the same priority are both saved',
    steps: '1. Testing season 3 > Hotel > Add contract: BB, AED, priority 71, default dates, 1 season with prices > Save\n2. Add a second contract with the same dates and priority 71 > Save',
    expected: 'The second contract is refused: the same priority is not allowed', actual: 'Both are saved ("QA Auto Contract SSMNRL prio A" and "prio B", both priority 71)', tc: 'TC-RULE-11' },
  { id: 'BUG-55', mod: 'Supplier - Contract', screen: 'Financials > Remove currency / Contract list', type: 'Business rule', sev: 'High',
    title: 'Removing a currency that a contract uses leaves the contract Approved (should become Provisional)',
    steps: '1. Testing season 3 > Financials > Add currency USD\n2. Hotel > Add contract in USD > Save > Approve\n3. Financials > Remove USD > popup "USD is used by contracts" > Remove anyway\n4. Open the contract list',
    expected: 'The USD contract moves to Provisional, so no booking can be made on it', actual: 'The popup appears (correct) but the contract stays "Approved" and active', tc: 'TC-RULE-21/22' },
  // ----- round 2: product owner's answers in Supplier-Questions.ods (17-Nov-2026) -----
  { id: "BUG-56", mod: "Supplier", screen: "Supplier > Overview (Blocked) > Edit", type: "Business rule", sev: "Medium",
    title: "A Blocked supplier can be moved back to \"On hold\"",
    steps: "1. Open a Blocked supplier (e.g. \"QA Auto Supplier RNMKVV evidence\")\n2. Click Edit and look at the status buttons", expected: "Blocked can only go to Approved (On hold is only for new suppliers)", actual: "\"On Hold\" is offered and selectable", tc: "TC-R2-01" },
  { id: "BUG-57", mod: "Supplier", screen: "Supplier > Overview > Edit > Location", type: "Business rule", sev: "Medium",
    title: "The supplier City can be changed after the supplier is created",
    steps: "1. Testing season 3 > Edit\n2. Open Location", expected: "City is fixed after creation (read-only)", actual: "City \"Abu Dhabi\" is an editable drop-down", tc: "TC-R2-02" },
  { id: "BUG-58", mod: "Supplier", screen: "Supplier > Financials > Add currency", type: "Validation", sev: "Low",
    title: "Payment due of 366 days is accepted (allowed 0-365)",
    steps: "1. Testing season 3 > Financials > Add currency USD\n2. Payment due days 366 > Save", expected: "Refused: payment days must be 0-365", actual: "The currency is sent with 366 days (red banner only because the test blocks the save)", tc: "TC-R2-03" },
  { id: "BUG-59", mod: "Supplier", screen: "Supplier > Financials > Add bank account", type: "Validation", sev: "Medium",
    title: "IBAN is not validated (\"123\" is accepted)",
    steps: "1. Financials > Add bank account\n2. Holder, bank, IBAN \"123\", SWIFT \"ABCDAEAD\" > Save", expected: "IBAN checked (country format, length, check digits)", actual: "The bank account is sent with IBAN \"123\"", tc: "TC-R2-04" },
  { id: "BUG-60", mod: "Supplier", screen: "Supplier > Contacts > Add contact", type: "Validation", sev: "Medium",
    title: "A contact without email is accepted (email must be mandatory)",
    steps: "1. Contacts > Add contact\n2. Name and role only, no email > Save", expected: "\"Email is required\"", actual: "The contact is sent without an email", tc: "TC-R2-05" },
  { id: "BUG-61", mod: "Supplier", screen: "Supplier list", type: "Enhancement", sev: "Low",
    title: "Supplier list cannot be searched by city",
    steps: "1. Supplier list\n2. Look for a City column / search", expected: "A City column with search (product owner request)", actual: "Only Name, Code and Status", tc: "TC-R2-06" },
  { id: "BUG-62", mod: "Supplier - Contract", screen: "Products > Hotel > Contract > Add contract", type: "Business rule", sev: "Medium",
    title: "\"Sell to\" after \"Valid to\" is accepted",
    steps: "1. Add contract (BB, AED)\n2. Sell to = Valid to + 20 days > Save", expected: "Refused: Sell to must be on or before Valid to", actual: "The contract is sent", tc: "TC-R2-10" },
  { id: "BUG-63", mod: "Supplier - Contract", screen: "Products > Hotel > Contract (Rates)", type: "Business rule", sev: "Low",
    title: "Contract warns \"No allotment holds <room> ... bookings go on request\" (the contract always comes before the allotment)",
    steps: "1. Add contract, base plan BB, add a season, enter one price", expected: "No allotment warning on the contract", actual: "Orange warning \"No allotment holds Club for these contract dates ... Add it to an allotment\"", tc: "TC-R2-11" },
  { id: "BUG-64", mod: "Supplier - Contract", screen: "Contract > Cancellation policy", type: "Validation", sev: "High",
    title: "A cancellation charge of 150% is accepted (max 100%)",
    steps: "1. Add contract > Add cancellation policy\n2. Charge 150 (%) > Save", expected: "Refused: a percentage charge cannot exceed 100%", actual: "Sent with \"chargeValue\":150", tc: "TC-R2-14" },
  { id: "BUG-65", mod: "Supplier - Contract", screen: "Products > Hotel > Contract", type: "Business rule", sev: "Medium",
    title: "Two contracts with the same name are saved",
    steps: "1. Save contract \"QA Auto Contract <tag> same name\"\n2. Save a second contract with the same name", expected: "Second one refused: contract names are unique", actual: "Both are saved", tc: "TC-R2-23" },
  { id: "BUG-66", mod: "Supplier - Allotment", screen: "Products > Excursion > Allotment", type: "Business rule", sev: "High",
    title: "An allotment is saved for a product that has no contract",
    steps: "1. Testing season 3 > Excursion (no contract) > Allotment > Add allotment\n2. Name, unit, one block of 3 > Save", expected: "Refused: no allotment without a contract", actual: "The allotment is saved", tc: "TC-R2-30" },
  { id: "BUG-67", mod: "Supplier - Promotion", screen: "Products > Hotel > Promotions", type: "Validation", sev: "High",
    title: "A promotion with a 100% discount is saved (max 99%)",
    steps: "1. Add promotion, currency AED\n2. Discount 100 % > Save", expected: "Refused: maximum discount is 99%", actual: "The promotion is saved", tc: "TC-R2-31" },
  { id: "BUG-68", mod: "Supplier - Product", screen: "Products > Hotel > Add room", type: "Business rule", sev: "Medium",
    title: "Two rooms with the same name are saved on the same hotel",
    steps: "1. Create room \"QA Auto Room <tag>\" and rename it \"... edited\"\n2. Add another room with exactly that name > Create product", expected: "Refused: room names are unique per hotel (to be confirmed)", actual: "Both rooms are saved and shown side by side", tc: "TC-PRDC-05" },
  // ----- Agent -----
  { id: "BUG-69", mod: "Agent", screen: "Agent > Add Agent", type: "Validation", sev: "Medium",
    title: "A negative credit limit (-500) is accepted when creating an agent",
    steps: "1. Agent > Add Agent\n2. Name, email, exchange type, country, currency USD\n3. Allow credit on, Credit limit -500 > Create agent", expected: "Refused: the credit limit cannot be negative", actual: "The agent is sent with credit limit -500 (red banner only because the test blocks the save)", tc: "TC-AGF-06" },
];
async function main() {
  fs.mkdirSync(path.join(OUT_DIR, 'screenshots'), { recursive: true });
  const shots = fs.readdirSync(SHOTS).filter(f => f.endsWith('.png'));
  for (const f of shots) fs.copyFileSync(path.join(SHOTS, f), path.join(OUT_DIR, 'screenshots', f));
  const wb = new ExcelJS.Workbook();
  wb.creator = REPORTED_BY;
  wb.calcProperties.fullCalcOnLoad = true;
  const font = { name: 'Arial', size: 10 };
  const head = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const headFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  const sevFill = { High: 'FFF8CBAD', Medium: 'FFFFE699', Low: 'FFE2EFDA' };

  // ---------------- Bugs ----------------
  const ws = wb.addWorksheet('Bugs', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  ws.columns = [
    { key: 'id', width: 11 }, { key: 'title', width: 38 }, { key: 'mod', width: 16 }, { key: 'screen', width: 22 },
    { key: 'type', width: 13 }, { key: 'sev', width: 12 }, { key: 'steps', width: 42 }, { key: 'expected', width: 32 },
    { key: 'actual', width: 32 }, { key: 'tc', width: 20 }, { key: 'status', width: 10 }, { key: 'shot', width: 60 }, { key: 'file', width: 30 },
  ];
  ws.mergeCells('A1:M1');
  ws.getCell('A1').value = 'ERP (Pilot) - Bug Report: Login, Core, Supplier and Agent modules';
  ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  ws.mergeCells('A2:M2');
  ws.getCell('A2').value = `Environment: ${ENV}   |   Reported by: ${REPORTED_BY}   |   Date: ${DATE}   |   Click a file name to open the full-size screenshot.`;
  ws.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const headers = ['Bug ID', 'Title', 'Module', 'Screen(s)', 'Type', 'Severity', 'Steps to reproduce', 'Expected result', 'Actual result', 'Test case', 'Status', 'Screenshot', 'Screenshot file'];
  const hr = ws.getRow(4);
  headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = head; c.fill = headFill; c.border = border; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  hr.height = 22;
  ws.autoFilter = 'A4:M4';

  BUGS.forEach((b, i) => {
    const r = ws.getRow(5 + i);
    const file = shots.find(f => f.startsWith(b.id + '-'));
    r.values = [b.id, b.title, b.mod, b.screen, b.type, b.sev, b.steps, b.expected, b.actual, b.tc, 'Open', file ? '' : `No screenshot: ${b.noShot ?? 'not captured'}`, file ?? '-'];
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.font = font; c.border = border;
      c.alignment = { vertical: 'top', wrapText: true, horizontal: [1, 5, 6, 11].includes(col) ? 'center' : 'left' };
    });
    r.getCell(1).font = { ...font, bold: true };
    r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sevFill[b.sev] } };
    if (file) {
      r.height = 180;
      const img = wb.addImage({ filename: path.join(SHOTS, file), extension: 'png' });
      ws.addImage(img, { tl: { col: 11.05, row: 4 + i + 0.05 }, ext: { width: 410, height: 231 }, editAs: 'oneCell' });
      r.getCell(13).value = { text: file, hyperlink: `screenshots/${file}` };
      r.getCell(13).font = { ...font, color: { argb: 'FF0563C1' }, underline: true };
    } else {
      r.height = 80;
      r.getCell(12).font = { ...font, italic: true, color: { argb: 'FF7F7F7F' } };
    }
  });
  const last = 4 + BUGS.length;

  // ---------------- Summary (formulas count the Bugs sheet) ----------------
  const sm = wb.addWorksheet('Summary');
  sm.columns = [{ width: 30 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }];
  sm.getCell('A1').value = 'Bug summary'; sm.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  sm.getCell('A2').value = `Counts are formulas over the Bugs sheet (rows 5-${last}).`; sm.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const tbl = (startRow, title, colLetter, items) => {
    const hdr = sm.getRow(startRow);
    [title, 'High', 'Medium', 'Low', 'Total'].forEach((h, i) => { const c = hdr.getCell(i + 1); c.value = h; c.font = head; c.fill = headFill; c.border = border; c.alignment = { horizontal: 'center' }; });
    items.forEach((it, k) => {
      const row = sm.getRow(startRow + 1 + k);
      row.getCell(1).value = it;
      ['High', 'Medium', 'Low'].forEach((s, j) => {
        const count = BUGS.filter(b => b[colLetter.key] === it && b.sev === s).length;
        row.getCell(2 + j).value = { formula: `COUNTIFS(Bugs!$${colLetter.col}$5:$${colLetter.col}$${last},$A${startRow + 1 + k},Bugs!$F$5:$F$${last},"${s}")`, result: count };
      });
      const r0 = startRow + 1 + k;
      row.getCell(5).value = { formula: `SUM(B${r0}:D${r0})`, result: BUGS.filter(b => b[colLetter.key] === it).length };
      row.eachCell({ includeEmpty: true }, c => { c.font = font; c.border = border; });
    });
    const tr = sm.getRow(startRow + 1 + items.length);
    tr.getCell(1).value = 'Total';
    for (let j = 2; j <= 5; j++) {
      const L = String.fromCharCode(64 + j);
      tr.getCell(j).value = { formula: `SUM(${L}${startRow + 1}:${L}${startRow + items.length})` };
    }
    tr.eachCell({ includeEmpty: true }, c => { c.font = { ...font, bold: true }; c.border = border; });
    return startRow + items.length + 3;
  };
  const uniq = k => [...new Set(BUGS.map(b => b[k]))];
  let next = tbl(4, 'By module', { key: 'mod', col: 'C' }, uniq('mod'));
  tbl(next, 'By type', { key: 'type', col: 'E' }, uniq('type'));

  // ---------------- Test coverage ----------------
  const cv = wb.addWorksheet('Test coverage');
  cv.columns = [{ width: 34 }, { width: 70 }, { width: 14 }];
  cv.getCell('A1').value = 'What the automation checks'; cv.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  const rows = [
    ['Suite', 'What it covers', 'Tests'],
    ['Login (02, 03-login-*.spec.ts)', 'UI, validation, wrong credentials, edge cases (spaces, case, long input), session, remember me, sign out', '42'],
    ['Country (country.spec.ts)', 'UI/UX, add -> deactivate flow, popup text, duplicate, audit', '30'],
    ['Consistency (region-ui / product-ui)', '30 identical checks per screen on 8 Region + 9 Product screens: menu, toolbar, search (case, partial, spaces, clear), filter, sort, paging, columns, empty message, Add/Edit dialogs, required fields, name length, digits, popup, Cancel/Escape/x, audit tabs, logged-out access. Saves are BLOCKED.', '510'],
    ['End-to-end data flow (region-crud / product-crud)', '15 steps per screen on 5 Region + 9 Product screens: add, edit, rename, 3 duplicate variants, double-click Save, trim/special chars, rename to existing, deactivate, filters, reactivate, not offered in other dropdowns, audit, cleanup', '210'],
    ['Supplier UI (supplier-ui.spec.ts, supplier-gaps.spec.ts)', 'List (search, filter, paging, sort, Columns), Add form validation, supplier tabs: Overview, Contacts and addresses, Products, Financials (currencies, bank accounts, tax), Content editor, audit history. Read-only: every save is blocked', '67'],
    ['Supplier end-to-end (supplier-crud.spec.ts)', 'Create, rename, 2 contacts, currency, bank account, status changes, audit, 3 duplicate-name variants, block. Every QA supplier is left Blocked', '14'],
    ['Supplier contracts UI (contract-ui.spec.ts)', 'Products > Contract list (search, columns), Import from Excel, Add contract (defaults, required fields, base plan / currency / markets lists, date rules, priority, seasons and price sheet, warnings, discard), approved contract (values, Sheet/Rows, back-to-Draft question), Allotment, Promotions, Rate check, global Contracts list (search, filter, bulk actions). Read-only: every save is blocked', '34'],
    ['Supplier business rules (supplier-rules.spec.ts)', 'Rules confirmed by the product owner: Blocked supplier cannot be edited / get contacts / currencies, On hold stays editable, same contract priority refused, removing a used currency warns and makes the contract Provisional', '10'],
    ['Supplier rules round 2 (supplier-rules2.spec.ts)', "The product owner's 63 answers: blocked status flow, fixed city, payment days, IBAN, contact email, city search, default currency, sell dates, allotment warning, min stay, meal supplement, cancellation %, missing prices, price 0, seasons, contract names, allotment without contract, promotion % and scope", '20'],
    ['Supplier products (product-ui.spec.ts, product-crud.spec.ts)', 'Hotel rooms, excursions and private transfers: lists, read-only view, Edit, validation (name, view, capacity, height), drop-down lists, occupancy rows, age policy, pax bands, create / edit / history / duplicate / same name', '35'],
    ['Agent forms (agent-forms.spec.ts)', 'Every Agent button and dialog: add-form lists and switches (credit, portal login), inline and full edit, addresses, currencies, top-up, 4 ledger actions, loyalty, access, on-behalf. Read-only: every save is blocked', '26'],
    ['Agent end-to-end (agent-crud.spec.ts)', 'Create QA Auto Agent, list / email search, rename, addresses, add / remove currency, wallet top-up 100, deduct 20, promotional credit 25, loyalty +10 / over-deduct refused, products access, approve, duplicate email refused, block', '17'],
    ['Supplier contracts end-to-end (contract-crud.spec.ts)', 'On "Testing season 3" > Hotel: create contract with season and 4 prices, list + global list, re-open, rename and re-price, cancellation band, approve, Rate check, create allotment (Club, 5 rooms) and promotion (10%), then switch all to Active = No', '12'],
    ['Bug evidence (bug-evidence.spec.ts)', 'One red-outlined screenshot per bug (this report). Run: $env:EVIDENCE=\'1\'; npx playwright test bug-evidence', '31'],
  ];
  rows.forEach((v, i) => {
    const r = cv.getRow(3 + i); r.values = v;
    r.eachCell(c => { c.border = border; c.alignment = { wrapText: true, vertical: 'top' }; c.font = i ? font : head; if (!i) c.fill = headFill; });
  });
  cv.getCell('A19').value = 'Test data: every record created by the tests is named "QA Auto ..." and left DEACTIVATED (the ERP has no delete).';
  cv.getCell('A19').font = { ...font, italic: true };

  const out = path.join(OUT_DIR, 'ERP-Bug-Report.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`Written ${out}: ${BUGS.length} bugs, ${BUGS.filter(b => shots.some(f => f.startsWith(b.id + '-'))).length} with screenshots`);
}
main().catch(e => { console.error(e); process.exit(1); });
