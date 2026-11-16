import { Screen } from './screen.types';

/*
 * Core > Application list screens.
 * "differs" = how a screen is DIFFERENT from the standard master screen -> reported as an inconsistency.
 * (Feedback Questions is not a Name-list screen - see application-other.spec.ts)
 */
// NOTE (reported, not a test): headings 'Role', 'Language', 'Status', 'Account Group', 'Tax' are singular while other list screens are plural; Role URL is /contacttype

export const APPLICATION_SCREENS: Screen[] = [
  { entity: 'Currency', plural: 'Currencies', path: '/currency', sample: 'US Dollar', nameFromList: true },
  { entity: 'Role', plural: 'Role', path: '/contacttype', sample: 'Admin' },
  { entity: 'Language', plural: 'Language', path: '/languages', sample: 'English',
    differs: { nameRequiredMsg: 'Empty form is SENT to the server - no "Name is required" check in the browser (Name has no *)' } },
  { entity: 'Theme', plural: 'Themes', path: '/themes', menu: 'Themes', sample: 'Adventure',
    differs: {
      menuName: 'Menu item is plural "Themes" - other Application items are singular ("Currency", "Role", "Language")',
      popupText: 'Popup says "It stops appearing in pickers. Records already using it are unaffected." (standard: "This will mark the theme as deactive.")',
    } },
  { entity: 'Status', plural: 'Status', path: '/status', sample: 'Confirmed',
    differs: {
      popupText: 'Popup says "This will mark the status as inactive." (correct English) - every other screen says "deactive"',
    } },
];
