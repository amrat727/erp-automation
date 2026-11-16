import { Screen } from './screen.types';

/* Core > Product list screens (Excursion Setup is a different kind of page - see product-excursion.spec.ts) */
const DIGITS = 'Name field silently removes digits ("Zone 2" -> "Zone "); View Type / Room Category / Amenity / Room Type keep them';
const MENU = (m: string) => `Menu item is plural "${m}" - other menu items are singular ("Product Type", "Room Type"...)`;
const REQ = (f: string) => `Required "${f}" shows NO "is required" message when empty (Name does)`;
const POPUP_MARK_IT = 'Popup says "This will mark it as deactive." (standard: "This will mark the <x> as deactive.") + "deactive" grammar';
const POPUP_PICKERS = 'Popup says "It stops appearing in pickers. Records already using it are unaffected." (standard: "This will mark the <x> as deactive.")';

export const PRODUCT_SCREENS: Screen[] = [
  { entity: 'Product Type', plural: 'Product Types', path: '/producttype', nameCol: 2, sample: 'Hotel', required: ['Product'],
    differs: { stripsDigits: DIGITS, requiredMsg: REQ('Product'), popupText: POPUP_MARK_IT } },
  { entity: 'Product Class', plural: 'Product Classes', path: '/productclass', required: ['Product Type'],
    differs: { stripsDigits: DIGITS, requiredMsg: REQ('Product Type') } },
  { entity: 'Room Type', plural: 'Room Types', path: '/roomtypes', sample: 'Bunk',
    differs: { popupText: 'Popup says "It stops being offered for new product rooms. Products that already use it keep it." (standard: "This will mark the <x> as deactive.")' } },
  { entity: 'View Type', plural: 'View Types', path: '/viewtypes', sample: 'Park Facing', differs: { popupText: POPUP_PICKERS } },
  { entity: 'Room Category', plural: 'Room Categories', path: '/roomcategories', sample: 'Club', differs: { popupText: POPUP_PICKERS } },
  { entity: 'Supplement', plural: 'Supplements', path: '/supplements', menu: 'Supplements', sample: 'Room only', required: ['Product Type', 'Sequence'],
    differs: { menuName: MENU('Supplements'), stripsDigits: DIGITS, requiredMsg: REQ('Product Type') + ' - Sequence does show it', popupText: POPUP_MARK_IT } },
  { entity: 'Allotment', plural: 'Allotments', path: '/allotments', menu: 'Allotments',
    differs: { menuName: MENU('Allotments'), stripsDigits: DIGITS } },
  { entity: 'Addon', plural: 'Addons', path: '/addons', menu: 'Addons', required: ['Product Type'],
    differs: { menuName: MENU('Addons'), stripsDigits: DIGITS, requiredMsg: REQ('Product Type') } },
  { entity: 'Amenity', plural: 'Amenities', path: '/amenities', menu: 'Amenities', sample: 'Air Conditioning',
    differs: { menuName: MENU('Amenities'), popupText: POPUP_PICKERS } },
];
