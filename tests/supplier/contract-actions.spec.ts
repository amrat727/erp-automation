import { test, expect } from '../../fixtures';
import { Page, Response } from '@playwright/test';
import { ContractPage } from '../../pages/ContractPage';

/*
 * SUPPLIER CONTRACT ACTIONS - Submit for approval, Approve, Back to draft, Copy or roll over, duplicate code.
 * REAL saves on "Testing season 3" -> Hotel only ("QA Auto Contract <STAMP> ..."); afterAll switches every QA contract to Active = No.
 * Rules (product owner): copy = new contract, name must be unique; code optional but unique when filled; Back to draft stops new bookings.
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;
const NAME = `QA Auto Contract ${STAMP} actions`;
const CODE = `QA-${STAMP}-ACT`;
const ROOMS = ['Club Single', 'Club Double', 'Family Single', 'Family Double'];

test.describe.configure({ mode: 'serial' });
test.describe('Supplier contract: actions', () => {
  let page: Page;
  let c: ContractPage;

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    c = new ContractPage(page);
  });
  test.afterAll(async () => {
    test.setTimeout(300_000);
    try {
      await c.openProduct(SUP, 'Hotel', 'Contract');
      for (let i = 0; i < 8; i++) {
        const on = c.rows.filter({ hasText: /^QA Auto Contract/ }).getByRole('switch', { checked: true });
        if (await on.count() === 0) break;
        await on.first().click();
        const d = page.getByRole('dialog').last();
        if (await d.isVisible({ timeout: 2500 }).catch(() => false)) await d.getByRole('button', { name: /Deactivate|Turn off|Yes|Confirm|Save/ }).last().click();
        await page.waitForTimeout(2500);
        await c.openProduct(SUP, 'Hotel', 'Contract');
      }
    } catch (e) { console.log('cleanup failed: ' + e); } finally { await page.close(); }
  });

  const row = (name = NAME) => c.rows.filter({ has: page.locator('td:first-child p', { hasText: new RegExp(`^${name}$`) }) }).first();
  const status = async (name = NAME) => { await c.openProduct(SUP, 'Hotel', 'Contract'); return (await row(name).innerText()).match(/Draft|Approved|Pending[\w ]*|Submitted|Provisional/)?.[0] ?? '?'; };
  const openMine = async (name = NAME) => { await c.openProduct(SUP, 'Hotel', 'Contract'); await row(name).locator('td').first().click(); await expect(c.name).toHaveValue(name, { timeout: 60_000 }); };
  const waitSave = (what = /contracts/): Promise<Response | null> =>
    page.waitForResponse(r => ['POST', 'PUT', 'PATCH'].includes(r.request().method()) && what.test(r.url()), { timeout: 30_000 }).catch(() => null);
  const confirm = async () => { const d = page.getByRole('dialog').last(); if (await d.isVisible({ timeout: 3000 }).catch(() => false)) await d.getByRole('button', { name: /Submit|Approve|Back to draft|Yes|Confirm|Save|Copy|Create|Roll over/ }).last().click(); };
  const newContract = async (name: string, code: string) => {
    await c.openAddContract(SUP, 'Hotel');
    await c.name.fill(name);
    if (code) await c.code.fill(code);
    await c.pick(c.basePlan, 'Bed and breakfast');
    await c.pick(c.currency, /AED/);
    await c.priority.click(); await c.priority.press('Control+A'); await c.priority.pressSequentially(String(300 + Math.floor(Math.random() * 600))); await c.priority.press('Tab');
    await c.addSeason('QA Season');
    for (const r of ROOMS) await c.setPrice(r, 'QA Season', '250');
    const res = waitSave();
    await c.saveButton.click();
    return res;
  };

  test(`TC-CACT-01: Create "${NAME}" with code ${CODE} -> Draft`, async () => {
    const r = await newContract(NAME, CODE);
    expect(r?.ok(), `create failed ${r?.status()}`).toBe(true);
    expect(await status()).toBe('Draft');
  });

  test('TC-CACT-02: "Submit for approval" -> the contract waits for approval', async () => {
    await openMine();
    const submit = c.button('Submit for approval');
    await expect(submit).toBeVisible();
    const res = waitSave();
    await submit.click();
    await confirm();
    const r = await res;
    console.log(`submit -> ${r?.status()} ${r?.url()}`);
    expect(r?.ok(), 'submit for approval failed').toBe(true);
    const st = await status();
    console.log('status after submit: ' + st);
    expect(st, 'status did not change after "Submit for approval"').not.toBe('Draft');
  });

  test('TC-CACT-03: Approve -> Approved', async () => {
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const approve = row().getByRole('button', { name: `Approve ${NAME}` });
    if (await approve.count()) { await approve.click(); }
    else { await openMine(); await c.button('Approve').click(); }
    await confirm();
    await expect.poll(() => status(), { timeout: 60_000 }).toBe('Approved');
  });

  test('TC-CACT-04: "Back to draft" on the approved contract -> Draft again (no new bookings)', async () => {
    await openMine();
    const res = waitSave();
    await c.button('Back to draft').click();
    await confirm();
    const r = await res;
    console.log(`back to draft -> ${r?.status()}`);
    await expect.poll(() => status(), { timeout: 60_000 }).toBe('Draft');
  });

  test('TC-CACT-05: "Copy or roll over" creates a NEW Draft contract that needs its own name', async () => {
    await c.openProduct(SUP, 'Hotel', 'Contract');
    const before = await c.rows.count();
    await row().getByRole('button', { name: `Copy or roll over ${NAME}` }).click();
    const d = page.getByRole('dialog').last();
    const dialogShown = await d.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('copy dialog: ' + (dialogShown ? (await d.innerText()).replace(/\s+/g, ' ').slice(0, 600) : 'none - opened ' + page.url()));
    if (dialogShown) {
      const nameField = d.locator('input[type=text]').first();
      if (await nameField.count()) await nameField.fill(`${NAME} copy`);
      const res = waitSave();
      await d.getByRole('button', { name: /Copy|Create|Roll over|Save|Confirm/ }).last().click();
      const r = await res;
      expect(r?.ok(), `copy failed ${r?.status()}`).toBe(true);
    } else {
      await expect(c.name).toBeVisible({ timeout: 30_000 });
      console.log('copy opens the editor with name: ' + await c.name.inputValue());
      expect(await c.name.inputValue(), 'the copy keeps exactly the same name').not.toBe(NAME);
      await c.name.fill(`${NAME} copy`);
      const res = waitSave();
      await c.saveButton.click();
      expect((await res)?.ok(), 'saving the copy failed').toBe(true);
    }
    await c.openProduct(SUP, 'Hotel', 'Contract');
    await expect(c.rows).toHaveCount(before + 1, { timeout: 30_000 });
    expect(await status(`${NAME} copy`)).toBe('Draft');
  });

  test('TC-CACT-06: A second contract with the SAME code is refused (code unique when filled)', async () => {
    const r = await newContract(`QA Auto Contract ${STAMP} same code`, CODE);
    expect(r === null || !r.ok(), 'a second contract with the same code was saved').toBe(true);
  });
});
