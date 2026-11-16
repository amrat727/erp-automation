import { Screen } from './screen.types';

/* Core > Organization list screens */
export const ORGANIZATION_SCREENS: Screen[] = [
  { entity: 'Branch', plural: 'Branches', path: '/organization/branches', sample: 'Delhi Branch' },
  { entity: 'Department', plural: 'Departments', path: '/organization/departments', sample: 'Reservations',
    differs: { popupText: 'Department popup says "This will mark the BRANCH as deactive." - wrong screen name (copied from Branch)' } },
];
