import { Screen } from './screen.types';

/* Core > Product list screens (Excursion Setup is a different kind of page - see product-excursion.spec.ts) */
// Stage 21 Nov 2026: digits kept (BUG-22), required messages shown (BUG-23/24), popups standard (BUG-18/19/20), menu singular (BUG-21)

export const PRODUCT_SCREENS: Screen[] = [
  { entity: 'Product Type', plural: 'Product Types', path: '/producttype', nameCol: 2, sample: 'Hotel', required: ['Product'] },
  { entity: 'Product Class', plural: 'Product Classes', path: '/productclass', required: ['Product Type'] },
  { entity: 'Room Type', plural: 'Room Types', path: '/roomtypes', sample: 'Bunk' },
  { entity: 'View Type', plural: 'View Types', path: '/viewtypes', sample: 'Park Facing' },
  { entity: 'Room Category', plural: 'Room Categories', path: '/roomcategories', sample: 'Club' },
  { entity: 'Supplement', plural: 'Supplements', path: '/supplements', sample: 'Room only', required: ['Product Type', 'Sequence'] },
  { entity: 'Allotment', plural: 'Allotments', path: '/allotments' },
  { entity: 'Addon', plural: 'Addons', path: '/addons', required: ['Product Type'] },
  { entity: 'Amenity', plural: 'Amenities', path: '/amenities', sample: 'Air Conditioning' },
];
