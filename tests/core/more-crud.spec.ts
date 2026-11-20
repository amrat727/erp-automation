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
  { entity: 'Asset', plural: 'Assets', path: '/resources/assets', subModule: 'Resource',
    // v1.0.2: Asset Type* is required; the only type, "Vehicle", adds Category, Make, Model, Registration No / Date,
    // Passenger Capacity and Insurance Valid Till (all required)
    fillRequired: async (p, dlg, page) => {
      const pick = async (label: string) => { await dlg.getByRole('combobox', { name: label }).click(); await page.getByRole('option').first().click(); };
      // MUI date field "DD MMM YYYY": type each part (day, month number, year)
      const date = async (label: string, d: string, m: string, y: string) => {
        const box = dlg.getByText(new RegExp(`^${label}\\s*\\*?$`)).first().locator('xpath=following::input[1]');
        await box.click();
        for (const part of [d, m, y]) await box.pressSequentially(part, { delay: 30 });
      };
      await pick('Asset Type');
      await pick('Category');
      await dlg.getByRole('textbox', { name: 'Make' }).fill('QA');
      await dlg.getByRole('textbox', { name: 'Model' }).fill('Auto');
      await dlg.getByRole('textbox', { name: 'Registration No' }).fill(`QA ${Date.now().toString(36).toUpperCase()}`);
      await date('Registration Date', '01', '01', '2026');
      await dlg.getByRole('spinbutton', { name: 'Passenger Capacity' }).fill('4');
      await date('Insurance Valid Till', '31', '12', '2027');
    } },
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
