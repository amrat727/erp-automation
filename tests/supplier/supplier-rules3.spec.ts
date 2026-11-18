import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { ContractPage } from '../../pages/ContractPage';
import { ProductPage } from '../../pages/ProductPage';
import { bugShot, visible } from '../../pages/FormHelpers';

/*
 * SUPPLIER RULES - ROUND 3 (product owner's answers in Open-Questions.xlsx, 19 Nov 2026)
 *   S-09  a contract may be saved as Draft WITHOUT prices
 *   S-10  a product (room / excursion) can be deactivated (Active Yes / No), never deleted
 *   S3-01 contracts of an On hold supplier cannot be approved / sold - only once the supplier is Approved
 *   S3-05 promotions: choose which promotions combine, and cumulative or non-cumulative
 *   S3-10 contracts carry taxes
 *   S3-02 child age bands must NOT overlap (0-5 and 3-8 is refused)
 *   S3-13 a copy of an approved contract is a Draft again (covered by contract-actions TC-CACT-05)
 * SAFETY: every save is blocked. Evidence screenshots only with EVIDENCE=1.
 */
const SUP = 18;              // "Testing season 3" - status On hold
const evidence = process.env.EVIDENCE === '1';

test.describe('Supplier rules - round 3', () => {
  test.setTimeout(240_000);
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page, /rate-quote/); });

  test('TC-R3-01 (S-09): A contract with a season but no prices can be saved as Draft', async ({ page }) => {
    test.fail(true, 'BUG-96: a contract without prices cannot be saved as Draft ("Price every room in every season")');
    const c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill('QA Auto Contract no prices');
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.addSeason('QA Season');
    await c.saveButton.click();
    await page.waitForTimeout(3000);
    await c.problems.click().catch(() => {}); await page.waitForTimeout(1500);
    const why = (await page.locator('.MuiPopover-paper:visible, .MuiPopper-root:visible, [role=tooltip]:visible, .MuiMenu-paper:visible').allInnerTexts()).join(' / ').replace(/\s+/g, ' ');
    console.log(`problems: ${why} | sent: ${blocked.length}`);
    if (evidence) await bugShot(page, 'BUG-96-contract-draft-without-prices-refused', c.problems, c.saveButton);
    expect(blocked.length, 'the Draft is sent to the server').toBeGreaterThan(0);
  });

  test('TC-R3-02 (S-10): A room can be deactivated - "Active" field on the room, Active / Inactive counts on the list', async ({ page }) => {
    const p = new ProductPage(page);
    await p.open(SUP, 'Hotel');
    await expect(page.locator('main').getByText(/^Inactive/).first()).toBeVisible();
    await visible(page.locator('main button', { hasText: /^Club$/ })).click();
    await page.waitForTimeout(3000);
    const active = page.locator('main').getByText('Active', { exact: true }).first();
    await expect(active, 'room-level "Active" field').toBeVisible();
    await expect(active.locator('xpath=following::*[normalize-space()="Yes" or normalize-space()="No"][1]')).toBeVisible();
  });

  test('TC-R3-03 (S3-01): An On hold supplier has no Approved contracts', async ({ page }) => {
    test.fail(true, 'BUG-97: contracts of the On hold supplier "Testing season 3" were approved');
    await page.goto(`/suppliers/${SUP}/overview`);
    await expect(page.locator('main').getByText('On hold', { exact: true }).first()).toBeVisible({ timeout: 90_000 });
    const c = new ContractPage(page);
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const approved = c.rows.filter({ hasText: /Approved$/ });
    console.log('approved contracts on an On hold supplier: ' + await approved.count());
    if (evidence) await bugShot(page, 'BUG-97-on-hold-supplier-has-approved-contracts', page.getByText('On hold', { exact: true }).first(), approved.first());
    expect(await approved.count()).toBe(0);
  });

  test('TC-R3-04 (S3-05): A promotion lets you choose which promotions it combines with, cumulative or not', async ({ page }) => {
    test.fail(true, 'BUG-98: a promotion has only a "Combinable" switch - no choice of promotions, no cumulative / non-cumulative');
    const c = new ContractPage(page);
    await c.openProduct(SUP, 'Hotel', 'Promotions');
    await visible(page.locator('main').getByRole('button', { name: /Add promotion/i })).click();
    await expect(page.getByText('Combinable').first()).toBeVisible({ timeout: 30_000 });
    if (evidence) await bugShot(page, 'BUG-98-promotion-no-combine-options', page.getByText('Combinable').first());
    await expect(page.locator('main').getByText(/cumulative/i).first(), 'cumulative / non-cumulative option').toBeVisible({ timeout: 5_000 });
    await expect(page.locator('main').getByText(/combine with|combinable with/i).first(), 'which promotions it combines with').toBeVisible({ timeout: 5_000 });
  });

  test('TC-R3-05 (S3-10): A contract has tax fields (VAT / tourism fee, rates include tax)', async ({ page }) => {
    test.fail(true, 'BUG-99: the contract screen has no tax fields');
    const c = new ContractPage(page);
    await c.openAddContract(SUP, 'Hotel');
    if (evidence) await bugShot(page, 'BUG-99-contract-has-no-tax-fields', page.locator('main').getByText('Contract details').first());
    await expect(page.locator('main').getByText(/\btax(es)?\b|\bVAT\b/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
