import { test, expect } from '../../fixtures';
import { MasterListPage, deactivateTestRecords } from '../../pages/MasterListPage';

/*
 * CLEANUP - deactivates any test record ("QA Auto ...") that is still Active.
 * Only runs when asked:   $env:CLEANUP='1'; npx playwright test cleanup
 * SAFE: filter = Active + search "QA Auto" -> the table shows ONLY active test records.
 * Each one is deactivated through the normal popup (the popup only appears for an ACTIVE switch).
 */
const SCREENS: [string, string, string, number?][] = [
  ['State', 'States', '/states'], ['City', 'Cities', '/cities'], ['Market', 'Markets', '/markets'],
  ['Landmark', 'Landmarks', '/landmarks'], ['Province', 'Provinces', '/provinces'],
  // Core > Product
  ['Product Type', 'Product Types', '/producttype', 2], ['Product Class', 'Product Classes', '/productclass'],
  ['Room Type', 'Room Types', '/roomtypes'], ['View Type', 'View Types', '/viewtypes'], ['Room Category', 'Room Categories', '/roomcategories'],
  ['Supplement', 'Supplements', '/supplements'], ['Allotment', 'Allotments', '/allotments'], ['Addon', 'Addons', '/addons'], ['Amenity', 'Amenities', '/amenities'],
  // Core > Application / Resource / Organization / Accounts
  ['Role', 'Role', '/contacttype'], ['Language', 'Language', '/languages'], ['Theme', 'Themes', '/themes'], ['Status', 'Status', '/status'],
  ['Resource Type', 'Resource Types', '/resourcetypes'], ['Asset', 'Assets', '/resources/assets'],
  ['Branch', 'Branches', '/organization/branches'], ['Department', 'Departments', '/organization/departments'],
  ['Exchange Type', 'Exchange Types', '/exchangetypes'], ['Account Group', 'Account Group', '/accountgroup'], ['Tax', 'Tax', '/tax'],
];

for (const [entity, plural, path, nameCol] of SCREENS) {
  test(`cleanup: deactivate active "QA Auto" ${plural}`, async ({ page }) => {
    test.skip(process.env.CLEANUP !== '1', 'set CLEANUP=1 to run');
    const p = new MasterListPage(page, entity, plural, { nameCol });
    await p.open(path);
    const done = await deactivateTestRecords(p);
    // verify: no active test record left
    await p.open(path);
    await p.filterActive('Active');
    await p.search('QA Auto');
    // waits until the filtered list is shown; fails if an active test record really is left
    await expect(async () => expect((await p.names()).filter(n => n.startsWith('QA Auto')), 'active test records left').toEqual([])).toPass({ timeout: 30_000 });
    console.log(`${plural}: ${done} deactivated`);
  });
}
