import { test, expect } from '../../fixtures';
import { Page, Response } from '@playwright/test';
import { ProductPage } from '../../pages/ProductPage';

/*
 * SUPPLIER PRODUCTS - end-to-end (REAL saves, approved by the product owner) on supplier 18 "Testing season 3" only.
 * Creates "QA Auto Room <STAMP>" (Hotel), "QA Auto Excursion <STAMP>" and "QA Auto Transfer <STAMP>".
 * NOTE: the screen has no way to deactivate a product (asked the product owner), so these test products stay on the test supplier.
 */
const STAMP = process.env.RUN_STAMP!;
const SUP = 18;
const ROOM = `QA Auto Room ${STAMP}`;
const EXC = `QA Auto Excursion ${STAMP}`;
const TRF = `QA Auto Transfer ${STAMP}`;

test.describe.configure({ mode: 'serial' });
test.describe('Supplier products: end-to-end', () => {
  let page: Page;
  let p: ProductPage;

  test.beforeAll(async ({ browser }) => {
    const fs = await import('fs');
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v as string); }, session);
    p = new ProductPage(page);
  });
  test.afterAll(async () => { await page.close(); });

  /** click `button`, wait for the save request and return the reply */
  const saved = async (button: import('@playwright/test').Locator): Promise<Response> => {
    const res = page.waitForResponse(r => ['POST', 'PUT', 'PATCH'].includes(r.request().method()) && /product|room|service/i.test(r.url()) && !/rate-quote/.test(r.url()), { timeout: 60_000 });
    await button.click();
    const r = await res;
    console.log(`SAVE ${r.request().method()} ${r.url()} -> ${r.status()}`);
    return r;
  };

  test(`TC-PRDC-01: Create room "${ROOM}" (Sea View, charged per Room, 2 occupancies) -> it appears in the room list`, async () => {
    await p.open(SUP, 'Hotel');
    const before = await p.count('All');
    await p.addButton('Add room').click();
    await p.roomName.fill(ROOM);
    await p.pick(p.select(0), 'Sea View');
    const r = await saved(p.create);
    expect(r.ok(), `create room failed ${r.status()}`).toBe(true);
    await p.open(SUP, 'Hotel');
    await expect(p.item(ROOM)).toBeVisible({ timeout: 30_000 });
    expect(await p.count('All')).toBe(before + 1);
  });

  test('TC-PRDC-02: Re-opened, the room shows its saved values (name, view, Room, Double + Single)', async () => {
    await p.open(SUP, 'Hotel');
    await p.item(ROOM).click();
    await expect(p.roomName).toHaveValue(ROOM, { timeout: 30_000 });
    await expect(p.byValue('Sea View')).toBeVisible();
    await expect(p.byValue('Room')).toBeVisible();
    await expect(page.locator('main input[value="Double"]')).toBeVisible();
    await expect(page.locator('main input[value="Single"]')).toBeVisible();
  });

  test('TC-PRDC-03: Edit - rename the room and set Infant to 5 -> saved and shown', async () => {
    await p.open(SUP, 'Hotel');
    await p.item(ROOM).click();
    await p.edit.click();
    await p.roomName.fill(`${ROOM} edited`);
    await p.typeNumber(p.spin('Infant to'), '5');
    const r = await saved(p.saveChanges);
    expect(r.ok(), `save failed ${r.status()}`).toBe(true);
    await p.open(SUP, 'Hotel');
    await p.item(`${ROOM} edited`).click();
    await expect(p.roomName).toHaveValue(`${ROOM} edited`, { timeout: 30_000 });
    await expect(p.spin('Infant to')).toHaveValue('5');
    await expect(p.spin('Child from')).toHaveValue('6');
  });

  test('TC-PRDC-04: History of the room lists the change', async () => {
    await p.open(SUP, 'Hotel');
    await p.item(`${ROOM} edited`).click();
    await p.history.click();
    const panel = page.getByRole('dialog').last().or(page.locator('main [role=tabpanel]:visible').last());
    await expect(panel).toContainText(/edited|Room Name|changed|Updated/i, { timeout: 30_000 });
  });

  test('TC-PRDC-05: A second room with the SAME name is refused', async () => {
    // BUG-68 fixed on the stage build of 21 Nov 2026 (was: 'BUG (to confirm with the product owner): a second room with exactly the same name is saved on the same hotel')
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await p.roomName.fill(`${ROOM} edited`);
    await p.pick(p.select(0), 'Park Facing');
    const res = page.waitForResponse(r => r.request().method() === 'POST' && /product|room/i.test(r.url()), { timeout: 15_000 }).catch(() => null);
    await p.create.click();
    const r = await res;
    expect(r === null || !r.ok(), 'a second room with the same name was saved').toBe(true);
  });

  test(`TC-PRDC-10: Create excursion "${EXC}" (capacity 20, pax band 1-20) -> it appears in the list`, async () => {
    await p.open(SUP, 'Excursion');
    await p.addButton('Add excursion').click();
    await p.productName.fill(EXC);
    await p.typeNumber(page.locator('main input[type=number][placeholder="1"]').first(), '20');
    await page.locator('main button:visible', { hasText: /^Add pax band$/ }).click();
    await p.typeNumber(p.spin('Band 1 to'), '20');
    const r = await saved(p.create);
    expect(r.ok(), `create excursion failed ${r.status()}`).toBe(true);
    await p.open(SUP, 'Excursion');
    await expect(p.item(EXC)).toBeVisible({ timeout: 30_000 });
  });

  test('TC-PRDC-11: Re-opened, the excursion shows capacity 20 and the pax band 1-20', async () => {
    await p.open(SUP, 'Excursion');
    await p.item(EXC).click();
    await expect(p.productName).toHaveValue(EXC, { timeout: 30_000 });
    await expect(page.locator('main input[type=number][placeholder="1"]').first()).toHaveValue('20');
    await expect(p.spin('Band 1 from')).toHaveValue('1');
    await expect(p.spin('Band 1 to')).toHaveValue('20');
  });

  test('TC-PRDC-12: Duplicate the excursion -> the copy opens as a new product that needs a new name', async () => {
    await p.open(SUP, 'Excursion');
    await p.item(EXC).click();
    await p.duplicate.click();
    await expect(p.create).toBeVisible({ timeout: 30_000 });
    const copyName = await p.productName.inputValue();
    console.log('duplicate starts with name: ' + copyName);
    expect(copyName, 'the copy keeps exactly the same name').not.toBe(EXC);
    await p.cancel.click();
    const d = page.getByRole('dialog').last();
    if (await d.isVisible({ timeout: 2000 }).catch(() => false)) await d.getByRole('button', { name: 'Discard' }).click();
  });

  test(`TC-PRDC-20: Create private transfer "${TRF}" (capacity 4) -> the "No private transfer yet" message is gone`, async () => {
    await p.open(SUP, 'Private transfer');
    await p.addButton('Add private transfer').click();
    await p.productName.fill(TRF);
    await p.typeNumber(page.locator('main input[type=number][placeholder="1"]').first(), '4');
    const r = await saved(p.create);
    expect(r.ok(), `create transfer failed ${r.status()}`).toBe(true);
    await p.open(SUP, 'Private transfer');
    await expect(p.item(TRF)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/No private transfer yet/)).toHaveCount(0);
  });
});
