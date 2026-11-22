import { test, expect } from '../../fixtures';
import { MasterListPage, blockWrites } from '../../pages/MasterListPage';
import { Screen } from './screen.types';
import { withV102 } from './v102.known';

/*
 * UI / UX CONSISTENCY SUITE - the SAME checks for every master-data list screen
 * (used by region-ui.spec.ts and product-ui.spec.ts).
 * If a screen behaves differently from the standard, the test fails -> inconsistency found.
 *
 * SAFETY: every save/update/delete request is BLOCKED in these tests,
 * so nothing in the ERP can change, even if a click goes wrong.
 */
export function consistencySuite(prefix: string, subModule: string, screens: Screen[]) {
  for (const s of screens.map(withV102)) {
    const known = (reason?: string) => { if (reason) test.fail(true, `INCONSISTENT: ${reason}`); };
    const id = (n: number) => `TC-${prefix}-${s.entity.replace(/ /g, '')}-${String(n).padStart(2, '0')}`;
    const nameCell = (p: MasterListPage, name: string) => p.row(name).locator(`td:nth-child(${s.nameCol ?? 1})`);

    test.describe(`${s.entity} screen`, () => {
      let p: MasterListPage;
      let blocked: string[];

      test.beforeEach(async ({ page }) => {
        blocked = await blockWrites(page);
        p = new MasterListPage(page, s.entity, s.plural, { nameCol: s.nameCol, subModule, addLabel: s.addLabel });
      });

      // ---------------- page ----------------
      test(`${id(1)}: Opens from menu Core > ${subModule} > ${s.entity}`, async ({ page }) => {
        await p.openViaMenu(s.menu ?? s.entity);
        await expect(page).toHaveURL(new RegExp(`${s.path}$`));
        await expect(p.heading).toBeVisible();
        await expect(page.getByRole('button', { name: s.menu ?? s.entity, exact: true })).toHaveClass(/selected|active/i);
        // menu items should all be named the same way (singular, like the screen)
        known(s.differs?.menuName);
        await expect(page.getByRole('button', { name: s.entity, exact: true })).toBeVisible({ timeout: 3_000 });
      });

      test(`${id(2)}: Toolbar has "Add ${s.entity}" button`, async () => {
        if (s.noAddByDesign) {
          // no Add on purpose (product owner) - make sure it stays that way
          await p.open(s.path);
          await expect(p.heading).toBeVisible();
          await expect(p.addButton).toHaveCount(0);
          return;
        }
        known(s.differs?.noAdd);
        await p.open(s.path);
        await expect(p.addButton).toBeVisible({ timeout: 5_000 });
        await expect(p.addButton).toBeEnabled();
      });

      test(`${id(3)}: Toolbar has "Audit history" and "Columns"`, async ({ page }) => {
        known(s.differs?.noAudit);
        await p.open(s.path);
        await expect(p.columnsButton).toBeVisible();
        await expect(p.auditButton).toBeVisible({ timeout: 5_000 });
        await p.auditButton.click();
        const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
        for (const tab of ['All', 'Created', 'Updated', 'Deactivated']) await expect(audit.getByText(tab, { exact: true }).first()).toBeVisible();
      });

      test(`${id(4)}: Table has Name search, Active filter (default All) and paging`, async ({ page }) => {
        known(s.differs?.nameSearch);
        await p.open(s.path);
        await expect(p.nameSearch).toBeVisible({ timeout: 5_000 });
        await expect(p.nameSearch).toHaveAttribute('placeholder', /^Search( name)?$/);   // 20 Nov: "Search name"
        await p.showFilters('active');   // only one column filter is open at a time
        await expect(p.activeFilter).toHaveText('All');
        await expect(p.rangeText).toBeVisible();                       // "1–4 of 4"
        await expect(page.getByText(/^Page \d+ of \d+$/)).toBeVisible(); // "Page 1 of 1"
      });

      test(`${id(5)}: Active filter options are All / Active / Inactive`, async ({ page }) => {
        known(s.differs?.filterOptions);
        await p.open(s.path);
        await p.openActiveFilter();
        await expect(page.getByRole('option')).toHaveText(['All', 'Active', 'Inactive']);   // "Deactive" before the 21 Nov 2026 build (BUG-04 fix)
      });

      test(`${id(6)}: Search with no match shows "There are no records in ${s.entity}"`, async ({ page }) => {
        known(s.differs?.emptyMessage ?? s.differs?.nameSearch);
        await p.open(s.path);
        await p.nameSearch.fill('zzzqqq', { timeout: 5_000 });
        await expect(p.emptyMessage).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('0–0 of 0')).toBeVisible();
      });

      // ---------------- rows ----------------
      test(`${id(7)}: Every row has an Active switch and a Share button`, async () => {
        await p.open(s.path);
        test.skip(!(await p.rows.count()), `${s.entity} has no records yet`);
        const n = Math.min(await p.rows.count(), 10);
        for (let i = 0; i < n; i++) {
          const sw = p.rows.nth(i).locator('input[type=checkbox]');
          // screen-reader label must match the switch state
          await expect(sw).toHaveAttribute('aria-label', (await sw.isChecked()) ? 'Active' : 'Inactive');
          await expect(p.rows.nth(i).getByRole('button', { name: 'Share' })).toBeVisible();
        }
      });

      test(`${id(8)}: Search by name finds "${s.sample ?? '-'}"`, async () => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        await expect(p.row(s.sample!)).toBeVisible();
      });

      // ---------------- add dialog ----------------
      test(`${id(9)}: Add dialog has title, × / Cancel / Save, and Cancel closes it`, async () => {
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const dlg = p.dialog(`Add ${s.entity}`);
        await expect(dlg).toBeVisible();
        await expect(dlg.getByRole('button', { name: 'Close' })).toBeVisible();
        await expect(dlg.getByRole('button', { name: 'Save' })).toBeVisible();
        await dlg.getByRole('button', { name: 'Cancel' }).click();
        await expect(dlg).toBeHidden();
      });

      test(`${id(10)}: Saving an empty form shows "Name is required"`, async () => {
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd ?? s.differs?.nameRequiredMsg);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const dlg = p.dialog(`Add ${s.entity}`);
        await dlg.getByRole('button', { name: 'Save' }).click();
        await expect(dlg.getByText('Name is required')).toBeVisible();
        await expect(dlg).toBeVisible();
        expect(blocked, 'nothing may be sent to the server').toHaveLength(0);
      });

      test(`${id(17)}: Every required field shows "<field> is required" like Name does`, async () => {
        test.skip(!s.required?.length, 'no other required fields');
        known(s.differs?.requiredMsg);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const dlg = p.dialog(`Add ${s.entity}`);
        await dlg.getByRole('button', { name: 'Save' }).click();
        await expect(dlg.getByText('Name is required')).toBeVisible();
        for (const f of s.required!) await expect(dlg.getByText(`${f} is required`), `"${f}" message`).toBeVisible({ timeout: 3_000 });
      });

      test(`${id(16)}: Name field keeps what the user typed (letters, digits, spaces)`, async () => {
        test.skip(s.entity === 'Country' || !!s.nameFromList, 'Name is picked from a list');
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd ?? s.differs?.stripsDigits);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const nameBox = p.field(p.dialog(`Add ${s.entity}`), 'Name');
        await nameBox.pressSequentially('Zone 2 North-1');
        await expect(nameBox).toHaveValue('Zone 2 North-1', { timeout: 5_000 });
      });

      // ---------------- edit ----------------
      test(`${id(11)}: Clicking a row opens "Edit ${s.entity}" with its data filled in`, async ({ page }) => {
        if (s.noEditByDesign) {
          // read-only on purpose (product owner) - clicking a row must open nothing
          await p.open(s.path);
          await p.search(s.sample!);
          await nameCell(p, s.sample!).click();
          await page.waitForTimeout(1_000);
          await expect(page.getByRole('dialog')).toHaveCount(0);
          return;
        }
        known(s.differs?.noEdit);
        test.skip(!s.sample && !s.differs?.noEdit, `${s.entity} has no records yet`);
        await p.open(s.path);
        const name = s.sample ?? (await p.names())[0];
        await p.search(name);
        await nameCell(p, name).click();
        const dlg = p.dialog(`Edit ${s.entity}`);
        await expect(dlg).toBeVisible({ timeout: 5_000 });
        await expect(p.field(dlg, 'Name')).toHaveValue(name);
        await dlg.getByRole('button', { name: 'Cancel' }).click();
        await expect(dlg).toBeHidden();
      });

      // ---------------- deactivate popup ----------------
      test(`${id(12)}: Deactivate popup has warning icon, title and Yes/Cancel buttons`, async () => {
        known(s.differs?.popupTitle);
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        test.skip(!(await p.toggle(s.sample!).isChecked()), `sample "${s.sample}" is switched off - the popup needs an ACTIVE record (non-QA data is not switched back on without the owner)`);
        await p.clickToggle(s.sample!);
        await expect(p.popup).toBeVisible();
        await expect(p.popup).toHaveClass(/swal2-icon-warning/);
        await expect(p.popupConfirm).toBeVisible();
        await expect(p.popupCancel).toBeVisible();
        await expect(p.popupTitle).toHaveText(`Deactivate ${s.entity.toLowerCase()}?`, { timeout: 5_000 });
      });

      test(`${id(31)}: Popup buttons use the same capitals as every other button ("Yes, Deactivate" / "Cancel")`, async () => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        test.skip(!(await p.toggle(s.sample!).isChecked()), `sample "${s.sample}" is switched off`);
        await p.clickToggle(s.sample!);
        await expect(p.popupConfirm).toBeVisible();
        const label = (await p.popupConfirm.innerText()).trim();
        test.fail(label === 'Yes, deactivate', 'BUG-135: the confirm button says "Yes, deactivate" (small d) - buttons are Title Case ("Add Currency", "Add Role")');
        expect(label, 'exact confirm label').toBe('Yes, Deactivate');
        expect((await p.popupCancel.innerText()).trim()).toBe('Cancel');
        await p.popupCancel.click();
      });

      test(`${id(13)}: Popup message follows the standard sentence`, async () => {
        known(s.differs?.popupText);
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        test.skip(!(await p.toggle(s.sample!).isChecked()), `sample "${s.sample}" is switched off`);
        await p.clickToggle(s.sample!);
        await expect(p.popupText).toHaveText(`This will mark the ${s.entity.toLowerCase()} as inactive.`, { timeout: 5_000 });   // "deactive" before the 21 Nov 2026 build (BUG-03 fix)
      });

      test(`${id(14)}: Popup grammar is correct ("inactive", not "deactive")`, async () => {
        test.skip(!s.sample || !!s.differs?.popupText, 'covered by the message test');
        // BUG-03 ("deactive") fixed on the stage build of 21 Nov 2026
        await p.open(s.path);
        await p.search(s.sample!);
        test.skip(!(await p.toggle(s.sample!).isChecked()), `sample "${s.sample}" is switched off`);
        await p.clickToggle(s.sample!);
        await expect(p.popupText).toHaveText(`This will mark the ${s.entity.toLowerCase()} as inactive.`, { timeout: 5_000 });
      });

      test(`${id(15)}: Cancel on the popup keeps the record Active`, async () => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        test.skip(!(await p.toggle(s.sample!).isChecked()), `sample "${s.sample}" is switched off`);
        await p.clickToggle(s.sample!);
        await p.popupCancel.click();
        await expect(p.popup).toBeHidden();
        await expect(p.toggle(s.sample!)).toBeChecked();
        expect(blocked, 'Cancel must not send anything to the server').toHaveLength(0);
      });

      // ================= EDGE CASES (still nothing can be saved) =================
      test(`${id(18)}: Name with only spaces is rejected ("Name is required")`, async () => {
        test.skip(s.entity === 'Country' || !!s.nameFromList, 'Name is picked from a list');
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd ?? s.differs?.nameRequiredMsg);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const dlg = p.dialog(`Add ${s.entity}`);
        await p.field(dlg, 'Name').fill('     ');
        await dlg.getByRole('button', { name: 'Save' }).click();
        await expect(dlg.getByText('Name is required')).toBeVisible();
        expect(blocked, 'nothing may be sent to the server').toHaveLength(0);
      });

      test(`${id(19)}: Name is limited to 150 characters`, async () => {
        test.skip(s.entity === 'Country' || !!s.nameFromList, 'Name is picked from a list');
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd ?? s.differs?.nameMax);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        const nameBox = p.field(p.dialog(`Add ${s.entity}`), 'Name');
        await nameBox.fill('A'.repeat(300));
        expect((await nameBox.inputValue()).length).toBe(150);
      });

      test(`${id(20)}: × and Escape close the Add dialog without saving; it reopens empty`, async ({ page }) => {
        test.skip(s.entity === 'Country' || !!s.nameFromList, 'Name is picked from a list');
        test.skip(!!s.noAddByDesign, s.noAddByDesign ?? '');
        known(s.differs?.noAdd);
        await p.open(s.path);
        await p.addButton.click({ timeout: 5_000 });
        let dlg = p.dialog(`Add ${s.entity}`);
        await p.field(dlg, 'Name').fill('Typed but not saved');
        await dlg.getByRole('button', { name: 'Close' }).click();
        await expect(dlg).toBeHidden();
        await p.addButton.click();
        dlg = p.dialog(`Add ${s.entity}`);
        await expect(p.field(dlg, 'Name')).toHaveValue('');
        await p.field(dlg, 'Name').fill('Typed again');
        await page.keyboard.press('Escape');
        await expect(dlg).toBeHidden();
        expect(blocked, 'nothing may be sent to the server').toHaveLength(0);
      });

      test(`${id(21)}: Edit -> change Name -> Cancel keeps the old name`, async () => {
        test.skip(!!s.noEditByDesign, s.noEditByDesign ?? '');
        known(s.differs?.noEdit);
        test.skip(!s.sample, `${s.entity} has no records yet`);
        await p.open(s.path);
        await p.search(s.sample!);
        await nameCell(p, s.sample!).click();
        const dlg = p.dialog(`Edit ${s.entity}`);
        await expect(dlg).toBeVisible({ timeout: 5_000 });
        await p.field(dlg, 'Name').fill('Changed but cancelled');
        await dlg.getByRole('button', { name: 'Cancel' }).click();
        await expect(dlg).toBeHidden();
        await expect(p.row(s.sample!)).toBeVisible();
        expect(blocked, 'Cancel must not send anything to the server').toHaveLength(0);
      });

      test(`${id(22)}: Search is case-insensitive and matches part of the name`, async () => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        known(s.differs?.nameSearch);
        await p.open(s.path);
        await p.search(s.sample!.toUpperCase());
        await expect(p.row(s.sample!)).toBeVisible();
        await p.search(s.sample!.slice(0, 3).toLowerCase());          // first 3 letters
        await expect(p.row(s.sample!)).toBeVisible();
      });

      test(`${id(23)}: Search ignores spaces before/after the text`, async () => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        known(s.differs?.nameSearch ?? s.differs?.searchSpaces);
        await p.open(s.path);
        await p.nameSearch.fill(`  ${s.sample}  `);
        await expect(p.row(s.sample!)).toBeVisible({ timeout: 10_000 });
      });

      test(`${id(24)}: Clearing the search shows all records again`, async ({ page }) => {
        test.skip(!s.sample, `${s.entity} has no records yet`);
        known(s.differs?.nameSearch);
        await p.open(s.path);
        await expect(p.rows.first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        const total = await p.rangeText.innerText();                 // "1–10 of 30"
        test.skip(/ of 1$/.test(total), 'only one record - a search cannot narrow the list');
        await p.search(s.sample!);
        await expect(p.rangeText).not.toHaveText(total);
        await p.nameSearch.fill('');
        await expect(p.rangeText).toHaveText(total);
      });

      test(`${id(25)}: Active filter shows only active rows, Deactive only deactivated rows`, async () => {
        // the filter WORDING ("Inactive" vs "Deactive") is test 05 - here only that the filter works (helper accepts both words)
        await p.open(s.path);
        test.skip(!(await p.rows.count()), `${s.entity} has no records yet`);
        for (const [option, on] of [['Active', true], ['Deactive', false]] as const) {
          await p.filterActive(option);
          await expect(async () => {
            const states = await p.rows.locator('input[type=checkbox]').evaluateAll(els => els.map(e => (e as HTMLInputElement).checked));
            expect(states.every(c => c === on), `${option}: ${states}`).toBe(true);
          }).toPass({ timeout: 15_000 });
        }
      });

      test(`${id(26)}: Clicking "Name" sorts A->Z, clicking again sorts Z->A`, async ({ page }) => {
        await p.open(s.path);
        test.skip((await p.rows.count()) < 2, 'needs at least 2 records');
        // stage 21 Nov: sorting is the small "Sort by Name" icon - the column title itself is covered by the hidden filter box
        const header = await p.nameSort();
        const sorted = (list: string[], dir: 1 | -1) => [...list].sort((a, b) => dir * a.localeCompare(b, 'en', { sensitivity: 'base' }));
        // QA records saved with spaces around the name (BUG-113, untrimmed since v1.0.2) sort by the hidden spaces -
        // they are checked by the data-flow step 08, so only the real records are compared here
        const real = async () => (await p.names()).filter(n => !n.startsWith('QA Auto'));
        await header.click();
        await expect(async () => { const n = await real(); expect(n).toEqual(sorted(n, 1)); }).toPass({ timeout: 15_000 });
        await header.click();
        await expect(async () => { const n = await real(); expect(n).toEqual(sorted(n, -1)); }).toPass({ timeout: 15_000 });
      });

      test(`${id(27)}: Paging - Next page shows the next records, Previous goes back`, async ({ page }) => {
        await p.open(s.path);
        const total = Number((await p.rangeText.innerText()).split(' of ')[1].replace(/,/g, ''));
        test.skip(total <= 10, `only ${total} records - one page`);
        await expect(p.rangeText).toHaveText(`1–10 of ${(await p.rangeText.innerText()).split(' of ')[1]}`);
        const first = await p.names();
        await page.getByRole('button', { name: 'Go to next page' }).click();
        await expect(p.rangeText).toHaveText(/^11–/);
        await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
        await expect(async () => expect(await p.names()).not.toEqual(first)).toPass({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Go to previous page' }).click();
        await expect(p.rangeText).toHaveText(/^1–10 /);
      });

      test(`${id(28)}: Columns menu can hide the Active column and "Show all" brings it back`, async ({ page }) => {
        await p.open(s.path);
        const activeCol = p.activeHeader;
        await expect(activeCol).toBeVisible({ timeout: 5_000 });
        await p.columnsButton.click();
        const menu = page.locator('[role=presentation]').filter({ hasText: 'Show all' }).last();
        await menu.getByText('Active', { exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(activeCol).toBeHidden();
        await p.columnsButton.click();
        await menu.getByText('Show all', { exact: true }).click();     // restore (the choice may be remembered)
        await page.keyboard.press('Escape');
        await expect(activeCol).toBeVisible();
      });

      test(`${id(29)}: Audit history "Created" tab shows only "created" entries`, async ({ page }) => {
        known(s.differs?.noAudit);
        await p.open(s.path);
        await p.auditButton.click({ timeout: 5_000 });
        const audit = page.getByRole('dialog').filter({ hasText: 'Audit history' });
        await audit.getByText('Created', { exact: true }).first().click();
        await expect(audit.getByText(/ changes?$/)).toBeVisible();
        await page.waitForTimeout(1500);
        const lines = (await audit.innerText()).split('\n').filter(l => / (updated|deactivated|reactivated) /.test(l));
        expect(lines, 'non-"created" entries under Created tab').toEqual([]);
      });

      test(`${id(30)}: Opening ${s.path} while logged out goes to the login page`, async ({ browser }) => {
        const fresh = await browser.newPage();                           // new tab = no session
        await fresh.goto(s.path);
        await expect(fresh).toHaveURL(/\/login/, { timeout: 30_000 });
        await fresh.close();
      });
    });
  }
}
