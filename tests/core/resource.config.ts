import { Screen } from './screen.types';

/* Core > Resource list screens (Resource Mapping has no Name column - see resource-mapping.spec.ts) */
const PLURAL_MENU = (m: string) => `Menu item is plural "${m}" - "Personnel" and most Core menu items are singular`;

export const RESOURCE_SCREENS: Screen[] = [
  { entity: 'Resource Type', plural: 'Resource Types', path: '/resourcetypes', sample: 'Driver' }, // menu singular since 22 Nov 2026 (BUG-147 / KAN-162)
  { entity: 'Personnel', plural: 'Personnel', path: '/resources/personnel', sample: 'Amrat Choudhary', required: ['Personnel Type'] },
  { entity: 'Asset', plural: 'Assets', path: '/resources/assets', sample: 'Car' },
];
