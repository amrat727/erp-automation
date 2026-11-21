import { Screen } from './screen.types';
export type { Screen };


export const REGION_SCREENS: Screen[] = [
  { entity: 'Country', plural: 'Countries', path: '/countries', sample: 'India',
    differs: { noEdit: 'Country has no Edit - clicking a row does nothing' } },
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
    differs: {
      noAdd: 'Airport has no "Add Airport" button',
      noEdit: 'Airport has no Edit - clicking a row does nothing',
      emptyMessage: 'Empty search says "No records match these filters." instead of "There are no records in Airport"',
    } },
];
