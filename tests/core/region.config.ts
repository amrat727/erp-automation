import { Screen } from './screen.types';
export type { Screen };


export const REGION_SCREENS: Screen[] = [
  { entity: 'Country', plural: 'Countries', path: '/countries', sample: 'India' }, // Edit fixed 22 Nov 2026 (BUG-17 / KAN-35)
  { entity: 'State', plural: 'States', path: '/states', sample: 'Haryana', required: ['Country'] },
  { entity: 'City', plural: 'Cities', path: '/cities', sample: 'Dubai' },
  { entity: 'Market', plural: 'Markets', path: '/markets', sample: 'Default Market' },
  { entity: 'Desk Location', plural: 'Desk Locations', path: '/desk-locations' },
  { entity: 'Landmark', plural: 'Landmarks', path: '/landmarks', sample: 'DXB Terminal 1' },
  { entity: 'Province', plural: 'Provinces', path: '/provinces',
    differs: {
      popupTitle: 'Popup title is "Deactivate Province?" (capital P) - other screens use lower case',
    } },
  { entity: 'Airport', plural: 'Airports', path: '/airports', sample: 'Aalborg Airport',
    noAddByDesign: 'Airport has no Add on purpose - all airports are already loaded (product owner, 22 Nov 2026; KAN-21 closed as not-a-bug)',
    noEditByDesign: 'Airport has no Edit on purpose - the airport list is fixed (product owner, 22 Nov 2026; KAN-21)',
    differs: {
      emptyMessage: 'Empty search says "No records match these filters." instead of "There are no records in Airport"',
    } },
];
