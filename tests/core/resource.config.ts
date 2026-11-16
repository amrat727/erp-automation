import { Screen } from './screen.types';

/* Core > Resource list screens (Resource Mapping has no Name column - see resource-mapping.spec.ts) */
const POPUP_MARK_IT = 'Popup says "This will mark it as deactive." (standard: "This will mark the <x> as deactive.")';
const PLURAL_MENU = (m: string) => `Menu item is plural "${m}" - "Personnel" and most Core menu items are singular`;

export const RESOURCE_SCREENS: Screen[] = [
  { entity: 'Resource Type', plural: 'Resource Types', path: '/resourcetypes', menu: 'Resource Types', sample: 'Driver',
    differs: { menuName: PLURAL_MENU('Resource Types'), popupText: POPUP_MARK_IT } },
  { entity: 'Personnel', plural: 'Personnel', path: '/resources/personnel', sample: 'Amrat Choudhary', required: ['Personnel Type'],
    differs: { popupText: POPUP_MARK_IT, requiredMsg: 'Empty Personnel Type shows no "Personnel Type is required" (Name does)' } },
  { entity: 'Asset', plural: 'Assets', path: '/resources/assets', menu: 'Assets', sample: 'Car',
    differs: { menuName: PLURAL_MENU('Assets'), popupText: POPUP_MARK_IT } },
];
