import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';

/*
 * SUPPLIER - documents, audit history and contact roles (product owner's answers Q-04, Q-10, Q-38).
 * READ-ONLY: every save is blocked. Test files are generated in memory (no file is downloaded from anywhere).
 */
const SUP = 18;   // Testing season 3
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

const pdf = (sizeBytes: number) => {
  const head = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, sizeBytes - head.length), 32), Buffer.from('\n%%EOF\n')]);
};
const editSupplier = async (page: Page) => {
  await page.goto(`/suppliers/${SUP}/overview`);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.locator('main input[type=file]').first()).toBeAttached({ timeout: 60_000 });
};
const slot = (page: Page, name: string) => page.locator('main input[type=file]').filter({ has: page.locator('xpath=.') }).and(page.locator(`xpath=//*[contains(normalize-space(.),"${name}")]//input[@type="file"]`)).first();

test.describe('Documents', () => {
  test('TC-REST-01: Four document slots (Fire safety, Health and safety, Factsheet, Other compliance), PDF or image, one file each', async ({ page }) => {
    await editSupplier(page);
    for (const d of ['Fire safety certificate', 'Health and safety certificate', 'Factsheet', 'Other compliance document'])
      await expect(page.locator('main').getByText(d, { exact: true }).first(), d).toBeVisible();
    const inputs = await page.locator('main input[type=file]').evaluateAll(els => els.map(e => ({ accept: (e as HTMLInputElement).accept, multiple: (e as HTMLInputElement).multiple })));
    expect(inputs.length).toBe(4);
    for (const i of inputs) { expect(i.accept).toMatch(/pdf/); expect(i.accept).toMatch(/image\/(\*|jpeg)/); expect(i.accept).not.toMatch(/text|\.txt/); expect(i.multiple).toBe(false); }
  });

  test('TC-REST-02: A document above 5 MB is refused with a message (product owner: max 5 MB + prompt)', async ({ page }) => {
    // BUG-78 fixed on the stage build of 21 Nov 2026 (was: 'BUG: a 6 MB document gets no "max 5 MB" message (product owner: files above 5 MB must be refused with a prompt)')
    await editSupplier(page);
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto-6mb.pdf', mimeType: 'application/pdf', buffer: pdf(6 * 1024 * 1024) });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/5\s?MB|too (large|big)|size/i).first(), 'no message for a 6 MB file').toBeVisible({ timeout: 10_000 });
    expect(blocked.filter(b => /document|file|upload/i.test(b)), 'the 6 MB file was sent to the server').toEqual([]);
  });

  test('TC-REST-03: A small PDF is accepted for upload', async ({ page }) => {
    await editSupplier(page);
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto-small.pdf', mimeType: 'application/pdf', buffer: pdf(20 * 1024) });
    await page.waitForTimeout(3000);
    const shown = await page.getByText('qa-auto-small.pdf').count();
    console.log(`small pdf: shown ${shown}, requests ${blocked.join(' | ')}`);
    expect(shown > 0 || blocked.some(b => /document|file|upload/i.test(b)), 'the small PDF was not taken').toBe(true);
  });

  test('TC-REST-04: A text file (.txt) is refused', async ({ page }) => {
    test.fail(true, 'BUG: a .txt file is taken as a document (only PDF / images are allowed)');
    await editSupplier(page);
    await page.locator('main input[type=file]').first().setInputFiles({ name: 'qa-auto.txt', mimeType: 'text/plain', buffer: Buffer.from('not a document') });
    await page.waitForTimeout(3000);
    expect(blocked.filter(b => /document|file|upload/i.test(b)), 'a .txt file was sent as a document').toEqual([]);
    await expect(page.getByText('qa-auto.txt'), 'the .txt file is shown as uploaded').toHaveCount(0);
  });
});

test.describe('Audit history (every change with old and new value)', () => {
  test('TC-REST-10: Supplier list "Audit history" - filters All / Created / Updated / Deactivated and a change count', async ({ page }) => {
    await page.goto('/suppliers');
    await page.locator('main button:visible', { hasText: /^Audit history$/ }).click();
    const d = page.getByRole('dialog').last();
    for (const f of ['All', 'Created', 'Updated', 'Deactivated']) await expect(d.getByText(f, { exact: true }).first(), f).toBeVisible({ timeout: 30_000 });
    await expect(d.getByText(/\d+ changes/).first()).toBeVisible();
  });

  test('TC-REST-11: An "updated" entry shows the changed field with its old AND new value', async ({ page }) => {
    await page.goto('/suppliers');
    await page.locator('main button:visible', { hasText: /^Audit history$/ }).click();
    const d = page.getByRole('dialog').last();
    await d.getByText('Updated', { exact: true }).first().click();
    await expect(d.getByText(/ updated /).first()).toBeVisible({ timeout: 30_000 });
    const text = (await d.innerText()).replace(/\s+/g, ' ');
    // e.g. "Room name QA Auto Room X QA Auto Room X edited" / "Age policy · Infant to 2 5"
    expect(/Room name QA Auto Room \w+ QA Auto Room \w+ edited|Age policy · Infant to \d+ \d+|Approval status \w+ \w+/.test(text), text.slice(0, 400)).toBe(true);
  });

  test('TC-REST-12: The supplier\'s own History shows who created it and the first values (City, Code, Country)', async ({ page }) => {
    await page.goto(`/suppliers/${SUP}/overview`);
    await page.locator('main button[aria-label*="istory" i]:visible, main button[title*="istory" i]:visible').first().click();
    const d = page.getByRole('dialog').last();
    await expect(d).toContainText(/created Testing season 3/, { timeout: 30_000 });
    for (const f of ['City', 'Code', 'Country']) await expect(d.getByText(f, { exact: true }).first(), f).toBeVisible();
  });
});

test.describe('Contact roles come from Core', () => {
  test('TC-REST-20: The roles offered on a supplier contact are the Contact Types set up in Core', async ({ page }) => {
    await page.goto('/contacttype');
    await expect(page.locator('main tbody tr:visible').first()).toBeVisible({ timeout: 90_000 });
    const types = (await page.locator('main tbody tr:visible td:first-child').allInnerTexts()).map(s => s.trim()).filter(Boolean);
    console.log('Core contact types: ' + types.join(' | '));
    await page.goto(`/suppliers/${SUP}/contacts`);
    await page.getByRole('button', { name: /Add contact$/ }).last().click();
    await page.getByRole('dialog').last().getByPlaceholder('Reservations, Sales, Accounts…').click();
    if (!(await page.getByRole('option').first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false))) test.skip(true, 'DATA: no active Contact Type (role) in Core - reactivate one (question pending with the product owner)');
    await expect(page.getByRole('option').first()).toBeVisible();
    const roles = (await page.getByRole('option').allInnerTexts()).map(s => s.trim());
    console.log('Roles offered: ' + roles.join(' | '));
    for (const r of roles) expect(types, `role "${r}" is not a Core contact type`).toContain(r);
  });
});
