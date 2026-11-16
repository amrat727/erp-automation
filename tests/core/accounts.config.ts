import { Screen } from './screen.types';

/*
 * Core > Accounts > Configuration list screens.
 * Chart of Accounts / Account Group / Tax / Tax Detail are EMPTY in this company, so checks that need an
 * existing record skip themselves (no "sample").
 */
const INACTIVE_FILTER = 'Active filter says "Inactive" while Region/Product/Application screens say "Deactive"';
const NO_CLIENT_CHECK = 'Empty form is SENT to the server - no "Name is required" check in the browser (Name has no *)';
// NOTE (reported, not a test): headings 'Role', 'Language', 'Status', 'Account Group', 'Tax' are singular while other list screens are plural; Role URL is /contacttype

export const ACCOUNTS_SCREENS: Screen[] = [
  { entity: 'Account', plural: 'Chart of Accounts', path: '/chartofaccounts', menu: 'Chart of Accounts', nameCol: 2,
    required: ['Code', 'Classification', 'Branch', 'Department', 'Currency', 'Group'],
    differs: { menuName: 'Menu item "Chart of Accounts" does not match the entity "Account" (button "Add Account")', filterOptions: INACTIVE_FILTER } },
  { entity: 'Account Group', plural: 'Account Group', path: '/accountgroup',
    differs: { filterOptions: INACTIVE_FILTER, nameRequiredMsg: NO_CLIENT_CHECK } },
  { entity: 'Tax', plural: 'Tax', path: '/tax',
    differs: { filterOptions: INACTIVE_FILTER,
      nameRequiredMsg: 'Empty Name says "Enter a name." instead of the standard "Name is required"' } },
  { entity: 'Exchange Type', plural: 'Exchange Types', path: '/exchangetypes', sample: 'Default Exchange' },
];
