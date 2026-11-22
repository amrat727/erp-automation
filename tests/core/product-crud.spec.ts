import { crudSuite, Flow } from './master-crud';

// bugs found on the 5 screens whose Name field strips characters (Product Type, Product Class, Supplement, Allotment, Addon)
const STRIPPING: Flow['known'] = {
  // 6: fixed 22 Nov 2026 - a duplicate typed with spaces around it is rejected (BUG-25)
  // 8: fixed 21 Nov 2026 - trimmed, & ( ) kept (BUG-26)
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
