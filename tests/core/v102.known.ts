import { Screen } from './screen.types';

/*
 * Stage build v1.0.2 (deployed 19 Nov 2026) - REGRESSIONS against the agreed Core standard.
 * The tests keep checking the standard; these entries only turn the matching checks into "known bug" (test.fail),
 * so they still report and start PASSING (= alert "fixed") as soon as the build is corrected.
 * Merged into each screen's "differs" by master-ui.ts.  Remove an entry when its bug is fixed.
 */
export const NAME_100 = 'BUG-112: since v1.0.2 Name stops at 100 characters - product owner confirmed 150 (Theme / Amenity still 150)';
export const NAME_NO_LIMIT = 'BUG-112: since v1.0.2 Name has NO limit (300 characters typed are kept) - product owner confirmed 150';
export const STRIPS = 'BUG-113: since v1.0.2 the Name field silently removes digits and & ( ) , . / ("Zone 2 North-1" -> "Zone  North-")';
const EMPTY = (shown: string) => `BUG-114: empty search says "There are no records in ${shown}" - internal / wrong screen name`;

export const V102: Record<string, NonNullable<Screen['differs']>> = {
  // Region
  'State': { nameMax: NAME_100 },
  'City': { nameMax: NAME_100 },
  'Market': { nameMax: NAME_100 },
  'Desk Location': { nameMax: NAME_100 },
  'Province': { nameMax: NAME_100 },
  // Resource
  'Resource Type': { nameMax: NAME_NO_LIMIT },
  'Personnel': { nameMax: NAME_NO_LIMIT, emptyMessage: EMPTY('Resource') },
  'Asset': { nameMax: NAME_NO_LIMIT, emptyMessage: EMPTY('Resource') },
  // Accounts > Configuration
  'Account': { nameMax: NAME_100, emptyMessage: EMPTY('Chart Of Accounts') },
  'Account Group': { nameMax: NAME_NO_LIMIT },
  'Tax': { nameMax: NAME_100 },
  'Exchange Type': { nameMax: NAME_100, stripsDigits: STRIPS },
  // Application
  'Currency': { noEdit: 'BUG-115: since v1.0.2 clicking a Currency row opens nothing (no "Edit Currency" - Symbol can no longer be changed)' },
  'Role': { nameMax: NAME_100, stripsDigits: STRIPS, emptyMessage: EMPTY('Contact Type') },
  'Language': { nameMax: NAME_NO_LIMIT },
  'Theme': { emptyMessage: EMPTY('Property Theme') },
  'Status': { nameMax: NAME_100, stripsDigits: STRIPS },
  // Organization
  'Branch': { nameMax: NAME_100, stripsDigits: STRIPS },
  'Department': { nameMax: NAME_100, stripsDigits: STRIPS },
  // Product
  'Product Type': { nameMax: NAME_100 },
  'Product Class': { nameMax: NAME_100 },
  'Room Type': { nameMax: NAME_NO_LIMIT },
  'View Type': { nameMax: NAME_100 },
  'Room Category': { nameMax: NAME_100 },
  'Supplement': { nameMax: NAME_100 },
  'Allotment': { nameMax: NAME_100 },
  'Addon': { nameMax: NAME_100 },
};

/** data-flow steps (master-crud.ts) that v1.0.2 broke: entity -> step -> reason */
const DUP_SPACES = 'BUG-113: since v1.0.2 a DUPLICATE name typed with spaces around it is SAVED (201) - the name is no longer trimmed';
const SPECIALS = 'BUG-113: since v1.0.2 & ( ) are silently REMOVED from the Name ("Edge & Co (Test)" saved as "Edge Co Test")';
const CREATED = (e: string) => `BUG-119: since v1.0.2 the message is "${e} created" - every other screen says "<X> created successfully"`;
const CITY_OFFERED = 'BUG-129: since v1.0.2 a DEACTIVATED City is still offered in the Landmark City dropdown';
const PROVINCE_DUP = 'BUG-120: since v1.0.2 Province and City accept DUPLICATE names (same name, other letter case, spaces around, rename to an existing name)';
const TAX_400 = 'BUG-118: since v1.0.2 Add Tax with only Name fails - 400 "appliedId could not be converted", banner "Request failed"; no Tax can be created';
export const V102_FLOW: Record<string, Record<number, string>> = {
  'State': { 6: DUP_SPACES, 8: SPECIALS },
  'Market': { 6: DUP_SPACES, 8: SPECIALS },
  'Landmark': { 8: SPECIALS },
  'City': { 4: PROVINCE_DUP, 5: PROVINCE_DUP, 6: PROVINCE_DUP, 8: SPECIALS, 9: PROVINCE_DUP, 12: CITY_OFFERED },
  'Province': { 4: PROVINCE_DUP, 5: PROVINCE_DUP, 6: PROVINCE_DUP, 8: SPECIALS, 9: PROVINCE_DUP },
  'Resource Type': { 6: DUP_SPACES },
  'Role': { 8: SPECIALS },
  'Status': { 8: SPECIALS },
  'Branch': { 1: CREATED('Branch'), 8: SPECIALS },
  'Department': { 1: CREATED('Department'), 8: SPECIALS },
  'Tax': Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14].map(n => [n, TAX_400])),
  'Exchange Type': { 8: SPECIALS },
};

/** the screen with the v1.0.2 known regressions added (the screen's own "differs" win) */
export const withV102 = (s: Screen): Screen => ({ ...s, differs: { ...V102[s.entity], ...s.differs } });
