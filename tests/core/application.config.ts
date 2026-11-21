import { Screen } from './screen.types';

/*
 * Core > Application list screens.
 * "differs" = how a screen is DIFFERENT from the standard master screen -> reported as an inconsistency.
 * (Feedback Questions is not a Name-list screen - see application-other.spec.ts)
 */
// NOTE (reported, not a test): headings 'Role', 'Language', 'Status', 'Account Group', 'Tax' are singular while other list screens are plural; Role URL is /contacttype

export const APPLICATION_SCREENS: Screen[] = [
  { entity: 'Currency', plural: 'Currencies', path: '/currency', sample: 'US Dollar', nameFromList: true },
  { entity: 'Role', plural: 'Roles', path: '/roles', sample: 'Admin' },   // stage 21 Nov: /contacttype redirects to /roles (BUG-36)
  { entity: 'Language', plural: 'Language', path: '/languages', sample: 'English' },
  { entity: 'Theme', plural: 'Themes', path: '/themes', sample: 'Adventure' },
  { entity: 'Status', plural: 'Status', path: '/status', sample: 'Confirmed' },
];
