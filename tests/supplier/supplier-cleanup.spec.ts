import { test, expect } from '../../fixtures';
import { SupplierPage } from '../../pages/SupplierPage';

/*
 * CLEANUP - sets every "QA Auto Supplier ..." that is NOT Blocked to Blocked.
 * Only runs when asked:   $env:CLEANUP='1'; npx playwright test --project=supplier supplier-cleanup
 * SAFE: only rows whose name starts with "QA Auto Supplier" are touched; real suppliers never are.
 * Each supplier is opened by its CODE and the code on the page is checked before anything is changed
 * (the list re-renders while loading, so a plain "click the first row" can open the wrong supplier).
 */
test('cleanup: block every "QA Auto Supplier" that is still open', async ({ page }) => {
  test.skip(process.env.CLEANUP !== '1', 'set CLEANUP=1 to run');
  test.setTimeout(600_000);
  const s = new SupplierPage(page);
  const openOnes = () => s.rows
    .filter({ has: page.locator('td:first-child', { hasText: /^QA Auto Supplier/ }) })
    .filter({ hasNot: page.locator('td:nth-child(3):text-is("Blocked")') });

  await s.open();
  await s.search('QA Auto Supplier');
  await expect(openOnes().first().or(s.emptyMessage)).toBeVisible();
  const todo: { name: string; code: string }[] = [];
  for (const row of await openOnes().all()) {
    const cells = await row.locator('td').allInnerTexts();
    todo.push({ name: cells[0].trim(), code: cells[1].trim() });
  }
  console.log(`to block: ${todo.map(t => `${t.code} ${t.name}`).join(' | ') || 'nothing'}`);

  for (const t of todo) {
    await s.open();
    await s.search(t.name);
    await s.rows.filter({ hasText: t.code }).first().locator('td').first().click();
    await expect(s.tab('Overview')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('main input[placeholder="Assigned when saved"]:visible')).toHaveValue(t.code, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await s.statusButton('Blocked').click();
    const save = page.getByRole('button', { name: 'Save', exact: true });
    if (await save.isEnabled()) await save.click();   // disabled = it was already Blocked
    await page.waitForTimeout(3000);
    console.log(`cleanup: ${t.code} "${t.name}" set to Blocked`);
  }

  await s.open();
  await s.search('QA Auto Supplier');
  await expect(openOnes()).toHaveCount(0);
});
