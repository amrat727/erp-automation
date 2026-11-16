import { crudSuite, Flow } from './master-crud';

// bugs found on the 5 screens whose Name field strips characters (Product Type, Product Class, Supplement, Allotment, Addon)
const STRIPPING: Flow['known'] = {
  6: 'a DUPLICATE name with spaces around it is SAVED (201) - two records with the same name appear in the list',
  8: 'special characters & ( ) are silently REMOVED from the Name ("Edge & Co (Test)" saved as "Edge Co Test")',
};

/*
 * CORE > PRODUCT - end-to-end data flow (the SAME scenarios as Region, see master-crud.ts)
 * Test records are named "QA Auto <Entity> <LETTERS>" and left DEACTIVATED.
 */
crudSuite([
  { entity: 'Product Type', plural: 'Product Types', path: '/producttype', known: STRIPPING, nameCol: 2,
    usedBy: { entity: 'Supplement', plural: 'Supplements', path: '/supplements', field: 'Product Type', activeExample: 'Hotel' },
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'Product', 'Accommodation'); } },
  { entity: 'Product Class', plural: 'Product Classes', path: '/productclass', known: STRIPPING,
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'Product Type', 'Hotel'); } },
  { entity: 'Room Type', plural: 'Room Types', path: '/roomtypes' },      // "Default" stays OFF
  { entity: 'View Type', plural: 'View Types', path: '/viewtypes' },
  { entity: 'Room Category', plural: 'Room Categories', path: '/roomcategories' },
  { entity: 'Supplement', plural: 'Supplements', path: '/supplements', known: STRIPPING,
    fillRequired: async (p, dlg) => {
      await p.pick(dlg, 'Product Type', 'Hotel');
      await p.field(dlg, 'Sequence').fill('99');
    } },
  { entity: 'Allotment', plural: 'Allotments', path: '/allotments', known: STRIPPING },
  { entity: 'Addon', plural: 'Addons', path: '/addons', known: STRIPPING,
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'Product Type', 'Hotel'); } },
  { entity: 'Amenity', plural: 'Amenities', path: '/amenities' },
]);
