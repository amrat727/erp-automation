import { test, expect } from '../../fixtures';
import { Locator, Page, Response } from '@playwright/test';
import { MasterListPage, deactivateTestRecords } from '../../pages/MasterListPage';

/*
 * END-TO-END DATA FLOW - the SAME scenarios for every master-data screen
 * (used by region-crud.spec.ts and product-crud.spec.ts):
 *   add -> edit -> rename -> duplicates -> double-click -> trim/special chars
 *   -> deactivate -> filter -> reactivate -> not offered in other screens' pickers -> audit
 *
 * Test data: names "QA Auto <Entity> <LETTERS>..." (unique per run).
 * The LAST step deactivates every record of this run that is still active. (No delete exists in the ERP.)
 * Steps run in order; a failing step does NOT stop the following ones (bugs are reported, flow continues).
 */

// unique LETTERS-only tag per run (many Name fields silently drop digits - see TC-xx-16)
// created ONCE per run in playwright.config.ts (workers restarted after a failure keep the same tag)
export const STAMP = process.env.RUN_STAMP!;

export type Flow = {
  entity: string; plural: string; path: string;
  subModule?: string;
  nameCol?: number;
  /** fill the required fields (besides Name) of the Add dialog */
  fillRequired?: (p: MasterListPage, dlg: Locator, page: Page) => Promise<void>;
  /** another screen whose dropdown lists this entity -> deactivated records must NOT be offered there */
  usedBy?: { entity: string; plural: string; path: string; field: string; activeExample: string };
  /** known bugs for a step: step number -> reason (the step runs as test.fail) */
  known?: Record<number, string>;
};

const isWrite = (method: string) => (r: Response) =>
  r.request().method() === method && r.url().includes('pilottest.runasp.net') && !r.url().includes('negotiate');

export function crudSuite(flows: Flow[]) {
  for (const f of flows) {
    test.describe(`${f.entity}: end-to-end data flow`, () => {
      const name = `QA Auto ${f.entity} ${STAMP}`;
      const edited = `${name} edited`;
      const edge = `${name} Edge & Co (Test)`;
      const step = (n: number) => `TC-${f.entity.replace(/ /g, '').toUpperCase()}-${String(n).padStart(2, '0')}`;
      const knownBug = (n: number) => { if (f.known?.[n]) test.fail(true, `BUG: ${f.known[n]}`); };
      const nameCell = (p: MasterListPage, n: string) => p.row(n).locator(`td:nth-child(${f.nameCol ?? 1})`);
      let p: MasterListPage;

      test.beforeEach(async ({ page }) => {
        p = new MasterListPage(page, f.entity, f.plural, { nameCol: f.nameCol, subModule: f.subModule });
        await p.open(f.path);
      });

      /** open Add, type a name, fill the other required fields, press Save; returns the server answer */
      async function addRecord(page: Page, typed: string) {
        await p.addButton.click();
        const dlg = p.dialog(`Add ${f.entity}`);
        await p.field(dlg, 'Name').fill(typed);
        if (f.fillRequired) await f.fillRequired(p, dlg, page);
        const [res] = await Promise.all([
          page.waitForResponse(isWrite('POST')),
          dlg.getByRole('button', { name: 'Save' }).click(),
        ]);
        return { res, dlg };
      }

      // ---------------- happy path ----------------
      test(`${step(1)}: Add a new ${f.entity} -> success message, shown as Active`, async ({ page }) => {
        knownBug(1);
        test.info().annotations.push({ type: 'test data', description: name });
        const { res, dlg } = await addRecord(page, name);
        expect(res.status(), await res.text()).toBe(201);
        await expect(page.getByText(new RegExp(`^${f.entity} created successfully`, 'i')).first()).toBeVisible();
        await expect(dlg).toBeHidden();
        await p.search(name);
        await expect(p.row(name)).toBeVisible();
        await expect(p.toggle(name)).toBeChecked();
      });

      test(`${step(2)}: Edit shows the saved values`, async () => {
        knownBug(2);
        await p.search(name);
        await nameCell(p, name).click();
        const dlg = p.dialog(`Edit ${f.entity}`);
        await expect(dlg).toBeVisible();
        await expect(p.field(dlg, 'Name')).toHaveValue(name);
        await dlg.getByRole('button', { name: 'Cancel' }).click();
      });

      test(`${step(3)}: Rename it -> success message and new name in the list`, async ({ page }) => {
        knownBug(3);
        await p.search(name);
        await nameCell(p, name).click();
        const dlg = p.dialog(`Edit ${f.entity}`);
        await p.field(dlg, 'Name').fill(edited);
        const [res] = await Promise.all([
          page.waitForResponse(isWrite('PUT')),
          dlg.getByRole('button', { name: 'Save' }).click(),
        ]);
        expect(res.ok(), await res.text()).toBe(true);
        await expect(page.getByText(new RegExp(`${f.entity} updated`, 'i')).first()).toBeVisible();
        await expect(dlg).toBeHidden();
        await p.search(edited);
        await expect(p.row(edited)).toBeVisible();
      });

      // ---------------- duplicates ----------------
      for (const [n, label, typed] of [
        [4, 'the SAME name', edited],
        [5, 'the same name in different letter case', edited.toUpperCase()],
        [6, 'the same name with extra spaces around it', `   ${edited}   `],
      ] as const) {
        test(`${step(n)}: Adding ${label} is rejected with a clear message`, async ({ page }) => {
          knownBug(n);
          const { res, dlg } = await addRecord(page, typed);
          expect(res.ok(), `duplicate was SAVED (status ${res.status()}) - the last step deactivates it`).toBe(false);
          await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible();
          await expect(dlg).toBeVisible();                  // user can correct the name
        });
      }

      test(`${step(7)}: Double-clicking Save creates only ONE record`, async ({ page }) => {
        knownBug(7);
        const twice = `${name} Twice`;
        const posts: string[] = [];
        page.on('request', r => { if (r.method() === 'POST' && r.url().includes('pilottest') && !r.url().includes('negotiate')) posts.push(r.url()); });
        await p.addButton.click();
        const dlg = p.dialog(`Add ${f.entity}`);
        await p.field(dlg, 'Name').fill(twice);
        if (f.fillRequired) await f.fillRequired(p, dlg, page);
        await dlg.getByRole('button', { name: 'Save' }).dblclick();
        await expect(dlg).toBeHidden({ timeout: 30_000 });
        await p.search(twice);
        await page.waitForTimeout(2000);
        expect(await p.row(twice).count(), `POST requests sent: ${posts.length}`).toBe(1);
      });

      test(`${step(8)}: Spaces around the name are trimmed; special characters & ( ) are kept`, async ({ page }) => {
        knownBug(8);
        const { res } = await addRecord(page, `   ${edge}   `);
        expect(res.status(), await res.text()).toBe(201);
        await p.search(`${name} Edge`);
        expect(await p.names()).toContain(edge);
      });

      test(`${step(9)}: Renaming a record to a name that already exists is rejected`, async ({ page }) => {
        knownBug(9);
        await p.search(`${name} Twice`);
        const target = `${name} Twice`;
        test.skip(!(await p.row(target).count()), 'needs the record from step 7');
        await nameCell(p, target).click();
        const dlg = p.dialog(`Edit ${f.entity}`);
        await p.field(dlg, 'Name').fill(edited);
        const [res] = await Promise.all([
          page.waitForResponse(isWrite('PUT')),
          dlg.getByRole('button', { name: 'Save' }).click(),
        ]);
        expect(res.ok(), `rename to an existing name was SAVED (status ${res.status()})`).toBe(false);
        await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible();
      });

      // ---------------- deactivate / reactivate ----------------
      test(`${step(10)}: Deactivate -> popup, confirm, "${f.entity} deactivated", switch off`, async ({ page }) => {
        knownBug(10);
        await p.search(edited);
        await expect(p.toggle(edited)).toBeChecked();     // only ever click an ACTIVE switch
        await p.clickToggle(edited);
        // case-insensitive: Province shows "Deactivate Province?" (capital P) - reported in the consistency findings
        await expect(p.popupTitle).toHaveText(new RegExp(`^Deactivate ${f.entity}\\?$`, 'i'));
        await p.popupConfirm.click();
        await expect(page.getByText(new RegExp(`${f.entity} deactivated`, 'i')).first()).toBeVisible();
        await expect(p.toggle(edited)).not.toBeChecked();
      });

      test(`${step(11)}: Deactivated record is listed under "Deactive", not under "Active"`, async () => {
        knownBug(11);
        await p.filterActive('Deactive');
        await p.search(edited);
        await expect(p.row(edited)).toBeVisible();
        await expect(p.toggle(edited)).not.toBeChecked();
        await p.filterActive('Active');
        await expect(p.row(edited)).toHaveCount(0, { timeout: 15_000 });
      });

      test(`${step(12)}: Deactivated record is NOT offered in other screens' dropdowns`, async ({ page }) => {
        test.skip(!f.usedBy, 'no other Core screen picks this entity');
        knownBug(12);
        const u = f.usedBy!;
        const other = new MasterListPage(page, u.entity, u.plural);
        await other.open(u.path);
        await other.addButton.click();
        const dlg = other.dialog(`Add ${u.entity}`);
        const box = other.field(dlg, u.field);
        await box.click();
        await box.fill(u.activeExample);                   // control: an active value IS offered
        await expect(page.getByRole('option', { name: u.activeExample, exact: true })).toBeVisible();
        await box.fill(edited);
        await page.waitForTimeout(2000);
        await expect(page.getByRole('option', { name: edited })).toHaveCount(0);
      });

      test(`${step(13)}: Reactivate (switch on) works, then deactivate again`, async ({ page }) => {
        knownBug(13);
        await p.search(edited);
        await expect(p.toggle(edited)).not.toBeChecked();
        await p.clickToggle(edited);                       // OUR record only
        if (await p.popup.isVisible().catch(() => false)) await p.popup.getByRole('button').first().click();
        await expect(p.toggle(edited)).toBeChecked({ timeout: 15_000 });
        await expect(page.getByText(new RegExp(`${f.entity} (re)?activated`, 'i')).first()).toBeVisible();
        // back to deactivated
        await p.clickToggle(edited);
        await expect(p.popupConfirm).toBeVisible();
        await p.popupConfirm.click();
        await expect(p.toggle(edited)).not.toBeChecked();
      });

      test(`${step(14)}: Audit history records created / updated / deactivated by Sahil Chauhan`, async ({ page }) => {
        knownBug(14);
        await p.auditButton.click();
        const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
        await expect(audit.getByText(`Sahil Chauhan created ${name}`).first()).toBeVisible();
        await expect(audit.getByText(new RegExp(`Sahil Chauhan updated (${edited}|${name})`)).first()).toBeVisible();
        await expect(audit.getByText(`Sahil Chauhan deactivated ${edited}`).first()).toBeVisible();
      });

      // ---------------- leave no active test data ----------------
      test(`${step(15)}: Cleanup - every record of this run ends up deactivated`, async () => {
        await deactivateTestRecords(p, STAMP);           // ONLY this run's records
        await p.filterActive('Active');
        await p.search(STAMP);
        await expect(async () => expect((await p.names()).filter(n => n.includes(STAMP)), 'active test records left').toEqual([])).toPass({ timeout: 30_000 });
      });
    });
  }
}
