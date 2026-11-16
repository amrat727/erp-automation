import { Screen } from './screen.types';
export type { Screen };


export const REGION_SCREENS: Screen[] = [
  { entity: 'Country', plural: 'Countries', path: '/countries', sample: 'India',
    differs: { noEdit: 'Country has no Edit - clicking a row does nothing' } },
  { entity: 'State', plural: 'States', path: '/states', sample: 'Haryana', required: ['Country'],
    differs: { requiredMsg: 'Missing Country shows only a banner at the top ("Please select a country.") - field not marked red like Name', stripsDigits: 'Name field silently removes digits ("Zone 2" -> "Zone "); Desk Location keeps them' } },
  { entity: 'City', plural: 'Cities', path: '/cities', sample: 'Dubai', differs: { stripsDigits: 'Name field silently removes digits ("Zone 2" -> "Zone "); Desk Location keeps them' } },
  { entity: 'Market', plural: 'Markets', path: '/markets', sample: 'Default Market', differs: { stripsDigits: 'Name field silently removes digits ("Zone 2" -> "Zone "); Desk Location keeps them' } },
  { entity: 'Desk Location', plural: 'Desk Locations', path: '/desk-locations',
    differs: {
      noAudit: 'Desk Location has no "Audit history" button',
      emptyMessage: 'Empty table says "No desk locations yet." instead of "There are no records in Desk Location"',
      nameSearch: 'Name search box says "Desk or hotel" and works differently',
      filterOptions: 'Desk Location has no Active filter in the table header',
    } },
  { entity: 'Landmark', plural: 'Landmarks', path: '/landmarks', sample: 'DXB Terminal 1',
    differs: { stripsDigits: 'Name field silently removes digits ("Zone 2" -> "Zone "); Desk Location keeps them', popupText: 'Popup says "This will mark it as deactive." (others: "mark the <x> as ...")' } },
  { entity: 'Province', plural: 'Provinces', path: '/provinces',
    differs: {
      stripsDigits: 'Name field silently removes digits ("Zone 2" -> "Zone "); Desk Location keeps them',
      filterOptions: 'Province filter says "Inactive" while all other screens say "Deactive"',
      popupTitle: 'Popup title is "Deactivate Province?" (capital P) - other screens use lower case',
    } },
  { entity: 'Airport', plural: 'Airports', path: '/airports', sample: 'Aalborg Airport',
    differs: {
      noAdd: 'Airport has no "Add Airport" button',
      noEdit: 'Airport has no Edit - clicking a row does nothing',
      emptyMessage: 'Empty search says "No records match these filters." instead of "There are no records in Airport"',
      popupTitle: 'Popup title uses the airport CODE ("Deactivate AAL?") instead of "Deactivate airport?"',
      popupText: 'Popup text is completely different ("It stops appearing in this company\'s Origin/Destination pickers...")',
    } },
];
