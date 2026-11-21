# Bugs to move to Jira (project KAN) - review

146 bugs · 48 Complete · 11 Reopened · 87 To Do · type Bug · assignee Sahil Chauhan

## Login & Access (KAN-4) - 2

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-01 | login-session | Medium | To Do | 1 | Spaces around Company code / Username are not trimmed |
| BUG-02 | login-session | Low | To Do | 1 | Logged-in user opening /login sees the login form |

## Company (KAN-5) - 1

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-86 | company-profile | Low | To Do | 1 | Company list has no column search and no paging |

## Core (KAN-6) - 38

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-03 | core-region | Low | Complete | 1 | Deactivate popup says "deactive" (not an English word) |
| BUG-05 | core-region | Low | Complete | 1+1 fix | Province filter says "Inactive" while all other screens say "Deactive" |
| BUG-06 | core-region | Low | To Do | 0 | Popup title "Deactivate Province?" uses a capital P |
| BUG-07 | core-region | Low | Complete | 1+1 fix | Landmark popup text differs ("mark it as deactive") |
| BUG-08 | core-region | Low | Complete | 1+1 fix | Airport popup title uses the airport CODE and completely different text |
| BUG-09 | core-region | High | Complete | 1+1 fix | Name field silently removes digits |
| BUG-10 | core-region | Medium | To Do | 1 | Countries is required but has no * on the label |
| BUG-11 | core-region | Low | Complete | 1+1 fix | Missing Country shown only as a banner - the field is not marked red like Name |
| BUG-12 | core-region | Medium | Complete | 1+1 fix | Desk Location has no Audit history and no Active filter |
| BUG-13 | core-region | Medium | Reopened | 1 | Airport has no "Add Airport" button (and no Edit) |
| BUG-14 | core-region | Medium | To Do | 1 | Add Country list still offers countries that are already added |
| BUG-15 | core-region | Low | To Do | 1 | Airport data contains "[Duplicate] Giebelstadt Army Air Field" |
| BUG-16 | core-region | Low | To Do | 1 | Audit history shows "sahil" on old entries and "Sahil Chauhan" on new ones |
| BUG-17 | core-region | Medium | Reopened | 1 | Country has no Edit - clicking a row does nothing |
| BUG-18 | core-product | Low | Complete | 1+1 fix | Popup says "This will mark it as deactive." (non-standard + grammar) |
| BUG-19 | core-product | Low | Complete | 1+1 fix | Popup uses a different sentence ("It stops appearing in pickers...") |
| BUG-20 | core-product | Low | Complete | 1+1 fix | Room Type popup uses yet another sentence |
| BUG-21 | core-product | Low | Complete | 1+1 fix | Menu items are partly plural, partly singular |
| BUG-22 | core-product | High | Complete | 1+1 fix | Name field silently removes digits |
| BUG-23 | core-product | Medium | Complete | 1+1 fix | Required "Product" shows no error message when empty |
| BUG-24 | core-product | Medium | Complete | 1+1 fix | Product Type gets no error while Sequence does (same form) |
| BUG-25 | core-product | High | To Do | 1 | Duplicate name is accepted when typed with spaces around it |
| BUG-26 | core-product | High | Complete | 1+1 fix | Name is saved with the spaces around it, and & ( ) are silently removed |
| BUG-30 | core-organization | Low | Complete | 1+1 fix | Department deactivate popup talks about the BRANCH |
| BUG-31 | core-application | Medium | Complete | 2+2 fix | Empty form is sent to the server - no "Name is required" check in the screen |
| BUG-36 | core-application | Low | Complete | 1+1 fix | Role screen: singular heading and URL /contacttype |
| BUG-37 | core-application | Low | Complete | 1+1 fix | Menu says "Flex1" but the page heading says "Flex 1" |
| BUG-40 | core-resource | Low | Complete | 1+1 fix | Popup says "This will mark it as deactive." (non-standard + grammar) |
| BUG-41 | core-resource | Medium | Complete | 1+1 fix | Required "Personnel Type" shows no error message when empty |
| BUG-115 | core-application | Medium | Reopened | 1 | Clicking a Currency row no longer opens "Edit Currency" - the Symbol cannot be changed any |
| BUG-117 | core-resource | Low | To Do | 1 | New required "Asset Type" shows only a banner "Please select a asset type." (wrong grammar |
| BUG-119 | core-organization | Low | To Do | 0 | Success message says "Branch created" - every other screen says "<X> created successfully" |
| BUG-120 | core-region | High | To Do | 0 | Province and City accept duplicate names - same name, other letter case, spaces around, an |
| BUG-125 | core-resource | Medium | To Do | 0 | The same Personnel -> Asset pairing that is already listed is sent again (no "already exis |
| BUG-126 | core-application | Low | To Do | 1 | /flex/11 opens a working "Flex 11" list although only Flex 1-10 exist |
| BUG-129 | core-region | Medium | To Do | 0 | A deactivated City is still offered in the Landmark "City" dropdown (new in stage build v1 |
| BUG-147 | core-resource | Low | To Do | 1 | Resource menu items are plural ("Resource Types", "Assets") while "Personnel" and all othe |
| BUG-148 | core-resource | High | To Do | 1 | Asset accepts duplicate names - the same name, other letter case and spaces around are all |

## Accounts (KAN-7) - 11

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-32 | accounts-configuration | Low | Complete | 1+1 fix | Empty Name message is "Enter a name." (all other screens: "Name is required") |
| BUG-33 | accounts-configuration | Low | Complete | 1+1 fix | Tax Name allows fewer than 150 characters (150 everywhere else) |
| BUG-38 | accounts-configuration | Low | Complete | 1+1 fix | Active filter says "Inactive" while Branch, Department, Exchange Rate... say "Deactive" |
| BUG-39 | accounts-configuration | Medium | To Do | 1 | Refund Payouts shows no list and no empty message |
| BUG-42 | accounts-configuration | Medium | Complete | 1+1 fix | Empty Tax Detail form is sent to the server |
| BUG-118 | accounts-configuration | High | To Do | 0 | No Tax can be created: saving with only Name (other fields optional) fails with 400 and "R |
| BUG-121 | accounts-journals | Low | To Do | 1 | "Post journal" / "Save" is just disabled on an empty form - nothing says which fields are  |
| BUG-122 | accounts-invoices | Medium | To Do | 1 | A negative Net amount is accepted - the invoice total shows "Total -100.00" (new in stage  |
| BUG-123 | accounts-periods-and-bank | Medium | To Do | 1 | "Close year" is enabled for a year that has no periods (new in stage build v1.0.2) |
| BUG-127 | accounts-configuration | Medium | To Do | 0 | Two rates have no automatic reverse rate: EUR -> INR 100 and USD -> INR 88 (01 Oct 2026) |
| BUG-145 | accounts-journals | Low | To Do | 1 | Accounts buttons are not Title Case: "New journal voucher", "Post journal", "Close year",  |

## System (KAN-8) - 4

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-34 | system-users-and-access | High | To Do | 1 | No user can be created: Restriction Group is required but the list is empty |
| BUG-35 | system-users-and-access | Medium | Complete | 1+1 fix | Restriction Groups has no "Audit history" (access rights changes are not traceable) |
| BUG-124 | system-users-and-access | High | To Do | 0 | The logged-in admin can switch off their OWN account - the normal "Deactivate user?" popup |
| BUG-128 | system-settings | High | To Do | 0 | Switching a retention rule on or off saves at once - no "Are you sure?" although the rule  |

## Supplier (KAN-9) - 37

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-43 | supplier-list-and-overview | High | To Do | 1 | A second supplier with the same name is saved (duplicate names allowed) |
| BUG-44 | supplier-list-and-overview | Low | Complete | 1+1 fix | Empty City says "Choose a city." while the other fields say "... is required" |
| BUG-45 | supplier-list-and-overview | Low | Complete | 1+1 fix | Status is spelled "On hold" in the list but "On Hold" on the supplier page |
| BUG-46 | supplier-financials | Medium | To Do | 1 | SWIFT code of 3 characters is sent to the server (no 8 or 11 characters check) |
| BUG-47 | supplier-list-and-overview | Low | Complete | 1+1 fix | Name search does not ignore spaces before/after the text |
| BUG-48 | supplier-contracts-and-rates | High | Complete | 1+1 fix | A contract is saved without the required Currency |
| BUG-49 | supplier-contracts-and-rates | Low | Complete | 1+1 fix | A negative Priority (-5) is accepted |
| BUG-51 | supplier-list-and-overview | High | Complete | 1+1 fix | A Blocked supplier can still be edited and saved |
| BUG-52 | supplier-contacts | High | Complete | 1+1 fix | A contact can be added to a Blocked supplier |
| BUG-53 | supplier-financials | High | Complete | 1+1 fix | A currency can be added to a Blocked supplier |
| BUG-54 | supplier-contracts-and-rates | High | To Do | 1 | Two contracts with the same priority are both saved |
| BUG-55 | supplier-contracts-and-rates | High | To Do | 1 | Removing a currency that a contract uses leaves the contract Approved (should become Provi |
| BUG-56 | supplier-list-and-overview | Medium | Complete | 1+1 fix | A Blocked supplier can be moved back to "On hold" |
| BUG-57 | supplier-list-and-overview | Medium | Complete | 1+1 fix | The supplier City can be changed after the supplier is created |
| BUG-58 | supplier-financials | Low | Complete | 1+1 fix | Payment due of 366 days is accepted (allowed 0-365) |
| BUG-59 | supplier-financials | Medium | Complete | 1+1 fix | IBAN is not validated ("123" is accepted) |
| BUG-60 | supplier-contacts | Medium | To Do | 1 | A contact without email is accepted (email must be mandatory) |
| BUG-61 | supplier-list-and-overview | Low | Complete | 1+1 fix | Supplier list cannot be searched by city |
| BUG-62 | supplier-contracts-and-rates | Medium | Complete | 1+1 fix | "Sell to" after "Valid to" is accepted |
| BUG-63 | supplier-contracts-and-rates | Low | To Do | 1 | Contract warns "No allotment holds <room> ... bookings go on request" (the contract always |
| BUG-64 | supplier-contracts-and-rates | High | Complete | 1+1 fix | A cancellation charge of 150% is accepted (max 100%) |
| BUG-65 | supplier-contracts-and-rates | Medium | To Do | 1 | Two contracts with the same name are saved |
| BUG-66 | supplier-excursions | High | Complete | 1+1 fix | An allotment is saved for a product that has no contract |
| BUG-67 | supplier-contracts-and-rates | High | To Do | 1 | A promotion with a 100% discount is saved (max 99%) |
| BUG-68 | supplier-hotel-products | Medium | Complete | 1+1 fix | Two rooms with the same name are saved on the same hotel |
| BUG-78 | supplier-list-and-overview | Medium | Complete | 1+1 fix | A document above 5 MB gets no message (max 5 MB with a prompt) |
| BUG-79 | supplier-list-and-overview | Medium | Complete | 1+1 fix | A document slot takes a .txt file (only PDF / images allowed) |
| BUG-80 | supplier-list-and-overview | Medium | Reopened | 1 | Supplier names are saved with spaces before / after the name (not trimmed) and sort before |
| BUG-81 | supplier-list-and-overview | Low | To Do | 1 | List button says "Add supplier" (small s) - every other module says "Add <Entity>" ("Add C |
| BUG-91 | supplier-hotel-products | Low | To Do | 1 | Add room lists its errors as a numbered banner ("Some fields need attention: 1. Enter a ro |
| BUG-96 | supplier-contracts-and-rates | High | Reopened | 1 | A contract without prices cannot be saved as Draft, although the screen says "The contract |
| BUG-97 | supplier-contracts-and-rates | High | Reopened | 1 | Contracts of an On hold supplier can be approved (9 approved on "Testing season 3", status |
| BUG-98 | supplier-contracts-and-rates | Medium | Reopened | 1 | Promotion has only a "Combinable" switch - no choice of WHICH promotions it combines with  |
| BUG-99 | supplier-contracts-and-rates | Medium | Reopened | 1 | The contract has no tax fields (VAT, tourism fee, "rates include tax") |
| BUG-134 | supplier-contracts-and-rates | Low | To Do | 1 | New contract dates default to the UTC date - between 00:00 and 04:00 UAE time Valid from / |
| BUG-138 | supplier-financials | Low | To Do | 1 | Field labels end with a "#" sign: "Phone#", "PAN#", "TAN#" |
| BUG-139 | supplier-list-and-overview | Low | To Do | 1 | Supplier buttons are not Title Case: "Add supplier", "Create supplier", "Add contact", "Ad |

## Agent (B2B) (KAN-10) - 11

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-69 | agent-financials-and-credit | Medium | To Do | 1 | A negative credit limit (-500) is accepted when creating an agent |
| BUG-70 | agent-list-and-overview | Medium | To Do | 1 | An Approved agent can be moved back to "On Hold" |
| BUG-71 | agent-list-and-overview | Medium | To Do | 1 | Client type General / Concierge / Desk exists (only B2B / B2C wanted) |
| BUG-72 | agent-list-and-overview | Low | To Do | 1 | The address phone number is not checked ("abc!!" is accepted) |
| BUG-73 | agent-list-and-overview | Low | To Do | 1 | The agent list cannot be filtered by Code |
| BUG-74 | agent-list-and-overview | Medium | To Do | 1 | Account manager is not required - the Add form has no Account manager field |
| BUG-75 | agent-financials-and-credit | Low | To Do | 1 | Agent currency payment days of 366 are accepted (allowed 0-365) |
| BUG-76 | agent-financials-and-credit | High | To Do | 1 | An agent currency can be removed (currencies must never be removed) |
| BUG-77 | agent-list-and-overview | Medium | To Do | 1 | A second agent with the same name is refused (duplicate names must be allowed) |
| BUG-92 | agent-financials-and-credit | Medium | To Do | 1 | Agent "Add currency" and "Add top-up" show only a banner - the field gets no message and i |
| BUG-140 | agent-list-and-overview | Low | To Do | 1 | Agent buttons are not Title Case: "Create agent", "Edit agent", "Add currency", "Add top-u |

## Contracts (KAN-11) - 4

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-50 | contracts-list | Low | Complete | 1+1 fix | "Valid" column has no year - a one-year contract looks like it ends before it starts |
| BUG-84 | contracts-list | Medium | To Do | 1 | Contracts list has no "Add Contract", no "Audit history" / "Columns" and no column search |
| BUG-101 | contracts-list | Low | Complete | 1 | The "Valid" column shows dates without a year ("15 Oct – 14 Oct") - the end looks earlier  |
| BUG-102 | contracts-list | Medium | To Do | 1 | Clicking a contract opens the supplier's "Choose a product type" page instead of that cont |

## Package (KAN-12) - 4

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-82 | package-builder | Low | To Do | 1 | Package list button says "Add New" instead of "Add Package" |
| BUG-104 | package-builder | Medium | To Do | 1 | Add Package: only Name gets "Name is required" - Currency*, Cities*, Base Price* get no me |
| BUG-105 | package-builder | Low | To Do | 1 | The "Add Bundle" form saves with a button called "Save Package" |
| BUG-106 | package-builder | Medium | To Do | 1 | "AI Generated" only highlights the card - no AI builder opens (Manual works) |

## Reservation (KAN-14) - 6

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-107 | reservation-booking | High | To Do | 1 | Add Quote, Add Reservation and Product Search offer Blocked agents in the Agent list |
| BUG-109 | reservation-booking | Medium | To Do | 1 | Reservation history shows raw JSON as the changed value instead of readable fields |
| BUG-130 | reservation-booking | High | To Do | 2 | A confirmed reservation is cancelled with one click from the status menu - no "Are you sur |
| BUG-131 | reservation-money-and-cancellation | High | To Do | 2 | Cancelling a reservation leaves its hotel line Confirmed, and the agent and supplier amoun |
| BUG-132 | reservation-product-search | Low | Reopened | 1 | Early-bird saving on single rooms is 2 fils off (350.98 instead of 351.00) |
| BUG-142 | reservation-booking | Low | To Do | 1 | Reservation / Quote buttons are not Title Case: "Send to customer", "Add room", "Build now |

## CRM (KAN-15) - 3

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-83 | crm-enquiries | Medium | To Do | 1 | Enquiries list is built differently from every other list (button, search, empty message,  |
| BUG-110 | crm-enquiries | Medium | To Do | 1 | New enquiry accepts the e-mail "abc" and sends it to the server (no e-mail check) |
| BUG-143 | crm-enquiries | Low | To Do | 1 | Enquiry buttons are not Title Case: "New enquiry", "Create enquiry" |

## Insights (KAN-16) - 2

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-111 | insights-dashboard | Low | To Do | 1 | Agent network counts Blocked and On hold agents as "active" ("19 active" while 11 are Bloc |
| BUG-141 | insights-dashboard | Low | To Do | 1 | Dashboard shortcut buttons are not Title Case: "Search products", "New reservation", "New  |

## Portal CMS (KAN-17) - 3

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-93 | portal-cms-storefront-and-content | Medium | To Do | 1 | Portal CMS forms show one banner for the first missing field ("Give the offer a heading.") |
| BUG-94 | portal-cms-emails-and-documents | High | To Do | 1 | An EMPTY document (no Name, which is mandatory) is sent to the server |
| BUG-144 | portal-cms-storefront-and-content | Low | To Do | 1 | Portal CMS buttons are not Title Case: "Save draft", "Save and publish", "New offer", "New |

## Cross-module (KAN-18) - 20

| Bug | Sub-module label | Priority | Status | Shots | Title |
|---|---|---|---|---|---|
| BUG-04 | cross-module-common-list-screens | Low | Complete | 1+1 fix | Active filter option is "Deactive" |
| BUG-27 | cross-module-common-list-screens | Medium | To Do | 1 | Search with spaces before/after the text finds nothing |
| BUG-28 | cross-module-common-list-screens | Medium | To Do | 0 | Re-activating a record has no confirmation popup (deactivating has one) |
| BUG-29 | cross-module-common-list-screens | Low | To Do | 0 | Form labels are not linked to their inputs |
| BUG-85 | cross-module-common-list-screens | Medium | To Do | 1 | Agent and Package lists have no "Audit history" button (Core, Supplier, Quotes, Reservatio |
| BUG-87 | cross-module-common-list-screens | Low | To Do | 1 | Same status written two ways: Supplier "On hold", Agent "On Hold" |
| BUG-88 | cross-module-common-list-screens | Low | To Do | 1 | Active filter says "Inactive" in Quotes and Reservation but "Deactive" in Core and Package |
| BUG-89 | cross-module-common-list-screens | Low | To Do | 1 | Full-page Add forms show an extra popup "Please fix the highlighted fields." - Core forms  |
| BUG-90 | cross-module-common-list-screens | Medium | To Do | 1 | Mandatory-field messages are worded differently from "<Field> is required" |
| BUG-95 | cross-module-common-list-screens | Medium | To Do | 1 | Supplier and Agent cannot be deactivated like Core records (no Active switch + "Deactivate |
| BUG-108 | cross-module-common-list-screens | Low | To Do | 1 | Quote and Reservation history show an internal number ("Quote / Reservation -9223372036854 |
| BUG-112 | cross-module-common-list-screens | Medium | Reopened | 1 | Name stops at 100 characters on 19 screens, although 150 was confirmed; 6 screens have no  |
| BUG-113 | cross-module-common-list-screens | High | To Do | 1 | Names are no longer trimmed and lose digits and & ( ) on more screens - duplicates get sav |
| BUG-114 | cross-module-common-list-screens | Low | Reopened | 1 | Empty search shows an internal or wrong screen name (new in stage build v1.0.2) |
| BUG-116 | cross-module-common-list-screens | High | To Do | 1 | Deactivating a record that is still in use gives no "already in use" warning |
| BUG-135 | cross-module-ui-text | Low | To Do | 1 | Deactivate popup button says "Yes, deactivate" (small d) - buttons are Title Case |
| BUG-136 | cross-module-ui-text | Medium | To Do | 1 | Shared buttons are not Title Case on every screen: "Audit history", "Close all", quick fil |
| BUG-137 | cross-module-ui-text | Medium | To Do | 1 | The same label is written in two different ways on different screens |
| BUG-146 | cross-module-ui-text | Low | To Do | 1 | Core / System buttons are not Title Case: "Upload image(s)", "Select all", "Save changes", |
| BUG-149 | cross-module-common-list-screens | High | To Do | 1 | Deactivate fails silently - server answers 400 "Duplicate value", the screen shows no mess |
