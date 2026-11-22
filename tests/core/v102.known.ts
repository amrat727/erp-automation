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
  // 22 Nov 2026 build: FIXED - every Name now stops at 150 (BUG-112), Currency edit is back (BUG-115),
  // empty-search message fixed on Role, Theme, Personnel, Asset (BUG-114; Account still wrong)
  // Accounts > Configuration
  'Account': { emptyMessage: EMPTY('Chart Of Accounts') },
  'Exchange Type': { stripsDigits: STRIPS },
};

/** data-flow steps (master-crud.ts) that v1.0.2 broke: entity -> step -> reason */
const DUP_SPACES = 'BUG-113: since v1.0.2 a DUPLICATE name typed with spaces around it is SAVED (201) - the name is no longer trimmed';
const SPECIALS = 'BUG-113: since v1.0.2 & ( ) are silently REMOVED from the Name ("Edge & Co (Test)" saved as "Edge Co Test")';
const CREATED = (e: string) => `BUG-119: since v1.0.2 the message is "${e} created" - every other screen says "<X> created successfully"`;
const CITY_OFFERED = 'BUG-129: since v1.0.2 a DEACTIVATED City is still offered in the Landmark City dropdown';
const PROVINCE_DUP = 'BUG-120: since v1.0.2 Province and City accept DUPLICATE names (same name, other letter case, spaces around, rename to an existing name)';
const TAX_400 = 'BUG-118: since v1.0.2 Add Tax with only Name fails - 400 "appliedId could not be converted", banner "Request failed"; no Tax can be created';
const ASSET_DUP = 'BUG-148: stage 21 Nov 2026 - Asset saves DUPLICATE names (same name, other letter case, spaces around) with 201';
export const V102_FLOW: Record<string, Record<number, string>> = {
  // fixed 22 Nov 2026: duplicates with spaces (Market, Resource Type), Province / City duplicates (BUG-120),
  // deactivated City in Landmark dropdown (BUG-129), Asset duplicates (BUG-148), "<X> created successfully" (BUG-119)
  'Tax': Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 13, 14].map(n => [n, TAX_400])),
  'Exchange Type': { 8: SPECIALS },
  'Status': { 14: 'BUG-150 (KAN-165): stage 22 Nov 2026 - Status audit history shows "0 changes" although records were created / edited / deactivated' },
};

/** the screen with the v1.0.2 known regressions added (the screen's own "differs" win) */
export const withV102 = (s: Screen): Screen => ({ ...s, differs: { ...V102[s.entity], ...s.differs } });
