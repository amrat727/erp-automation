import { Screen } from './screen.types';

/*
 * Core > Accounts > Configuration list screens.
 * Chart of Accounts / Account Group / Tax / Tax Detail are EMPTY in this company, so checks that need an
 * existing record skip themselves (no "sample").
 */
// Stage 21 Nov 2026: "Inactive" is the standard filter word (BUG-38), Name is checked in the browser (BUG-31 / BUG-32)
// NOTE (reported, not a test): headings 'Role', 'Language', 'Status', 'Account Group', 'Tax' are singular while other list screens are plural; Role URL is /contacttype

export const ACCOUNTS_SCREENS: Screen[] = [
  { entity: 'Account', plural: 'Chart of Accounts', path: '/chartofaccounts', menu: 'Chart of Accounts', nameCol: 2,
    required: ['Code', 'Classification', 'Branch', 'Department', 'Currency', 'Group'],
    differs: { menuName: 'Menu item "Chart of Accounts" does not match the entity "Account" (button "Add Account")' } },
  { entity: 'Account Group', plural: 'Account Groups', path: '/accountgroup' },
  { entity: 'Tax', plural: 'Taxes', path: '/tax' },
  { entity: 'Exchange Type', plural: 'Exchange Types', path: '/exchangetypes', sample: 'Default Exchange' },
];
