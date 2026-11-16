import { crudSuite } from './master-crud';

/*
 * CORE > APPLICATION / RESOURCE / ORGANIZATION / ACCOUNTS - end-to-end data flow
 * (the SAME 15 steps as Region and Product, see master-crud.ts)
 * Test records are named "QA Auto <Entity> <LETTERS>" and are left DEACTIVATED.
 *
 * Not here on purpose:
 *  - Currency: name is picked from a fixed list (no free-text name)
 *  - Personnel, Resource Mapping, Exchange Rate, Tax Detail, Chart of Accounts: different forms (own spec files)
 *  - Users, Journals, Invoices, settings: read-only by agreement (see readonly-*.spec.ts)
 */
crudSuite([
  // ---- Application
  { entity: 'Role', plural: 'Role', path: '/contacttype', subModule: 'Application' },
  { entity: 'Language', plural: 'Language', path: '/languages', subModule: 'Application' },
  { entity: 'Theme', plural: 'Themes', path: '/themes', subModule: 'Application' },
  { entity: 'Status', plural: 'Status', path: '/status', subModule: 'Application' },
  // ---- Resource
  { entity: 'Resource Type', plural: 'Resource Types', path: '/resourcetypes', subModule: 'Resource' },
  { entity: 'Asset', plural: 'Assets', path: '/resources/assets', subModule: 'Resource' },
  // ---- Organization
  { entity: 'Branch', plural: 'Branches', path: '/organization/branches', subModule: 'Organization',
    usedBy: { entity: 'Account', plural: 'Chart of Accounts', path: '/chartofaccounts', field: 'Branch', activeExample: 'Delhi Branch' } },
  { entity: 'Department', plural: 'Departments', path: '/organization/departments', subModule: 'Organization',
    usedBy: { entity: 'Account', plural: 'Chart of Accounts', path: '/chartofaccounts', field: 'Department', activeExample: 'Reservations' } },
  // ---- Accounts > Configuration
  { entity: 'Exchange Type', plural: 'Exchange Types', path: '/exchangetypes', subModule: 'Accounts > Configuration',
    usedBy: { entity: 'Exchange Rate', plural: 'Exchange Rates', path: '/exchangerates', field: 'Exchange Type', activeExample: 'Default Exchange' } },
  { entity: 'Account Group', plural: 'Account Group', path: '/accountgroup', subModule: 'Accounts > Configuration' },
  { entity: 'Tax', plural: 'Tax', path: '/tax', subModule: 'Accounts > Configuration' },
]);
