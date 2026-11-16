import { crudSuite, STAMP } from './master-crud';

/* CORE > REGION - end-to-end data flow (the shared scenarios live in master-crud.ts) */
let codeNo = 0;
const nextCode = () => `Q${STAMP.slice(1)}${'ABCDEFGHIJ'[codeNo++ % 10]}`;
crudSuite([
  { entity: 'State', plural: 'States', path: '/states',
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'Country', 'India'); } },
  { entity: 'City', plural: 'Cities', path: '/cities',
    usedBy: { entity: 'Landmark', plural: 'Landmarks', path: '/landmarks', field: 'City', activeExample: 'Dubai' },
    fillRequired: async (p, dlg) => {
      await p.field(dlg, 'Code').fill(nextCode());   // every add needs its own unique Code
      await p.pick(dlg, 'Country', 'India');
    } },
  { entity: 'Market', plural: 'Markets', path: '/markets',
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'Countries', 'India'); } },
  { entity: 'Landmark', plural: 'Landmarks', path: '/landmarks',
    fillRequired: async (p, dlg) => { await p.pick(dlg, 'City', 'Dubai'); } },
  { entity: 'Province', plural: 'Provinces', path: '/provinces',
    fillRequired: async (p, dlg, page) => {
      await p.pick(dlg, 'Country', 'India');
      await p.field(dlg, 'Cities').click();
      await page.getByRole('option').first().click();   // any city of India
      await page.keyboard.press('Escape');
    } },
]);
