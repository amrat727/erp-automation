import { test, expect } from '../../fixtures';
import { blockWrites } from '../../pages/MasterListPage';
import { ProductPage } from '../../pages/ProductPage';

/*
 * SUPPLIER -> PRODUCTS (rooms / excursions / private transfers) - UI and validation.
 * READ-ONLY: every save is blocked. Data: supplier 18 "Testing season 3" (Hotel rooms Club + Family, excursion "Jungle Safari").
 */
const SUP = 18;
let blocked: string[];
let p: ProductPage;
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); p = new ProductPage(page); });

test.describe('Hotel rooms', () => {
  test('TC-PRD-01: Hotel lists its rooms (Club, Family) with All / Active / Inactive counts and Cards / Table view @smoke', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await expect(p.item('Club')).toBeVisible();
    await expect(p.item('Family')).toBeVisible();
    expect(await p.count('All')).toBe(await p.count('Active') + await p.count('Inactive'));
    await expect(p.iconButton('Cards view')).toBeVisible();
    await expect(p.iconButton('Table view')).toBeVisible();
    await expect(page.getByText(/Pick a room to edit/)).toBeVisible();
  });

  test('TC-PRD-02: An existing room opens read-only with Duplicate, History and Edit', async () => {
    await p.open(SUP, 'Hotel');
    await p.item('Club').click();
    await expect(p.roomName).toHaveValue('Club', { timeout: 30_000 });
    await expect(p.roomName).toBeDisabled();
    for (const b of [p.duplicate, p.history, p.edit]) await expect(b).toBeVisible();
  });

  test('TC-PRD-03: Edit makes the room editable; "Save changes" stays disabled until something changes', async () => {
    await p.open(SUP, 'Hotel');
    await p.item('Club').click();
    await p.edit.click();
    await expect(p.roomName).toBeEnabled();
    await expect(p.saveChanges).toBeDisabled();
    await p.roomName.fill('Club x');
    await expect(p.saveChanges).toBeEnabled();
  });

  test('TC-PRD-04: Editing a room - an empty room name is refused ("Enter a room name.") and nothing is sent', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.item('Club').click();
    await p.edit.click();
    await p.roomName.fill('');
    await p.saveChanges.click().catch(() => {});
    await expect(page.getByText('Enter a room name.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-PRD-05: Add room - empty Create lists "Enter a room name." and "Select a view." and sends nothing', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await p.create.click();
    await expect(page.getByText(/Enter a room name\./).first()).toBeVisible();
    await expect(page.getByText(/Select a view\./).first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-PRD-06: Add room - lists: View (Park Facing / Sea View), Charged per (Room / Pax / Unit), Sell as (3 choices)', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await p.select(0).click();
    await expect(page.getByRole('option')).toHaveText(['Park Facing', 'Sea View']);
    await page.keyboard.press('Escape');
    await p.byValue('Room').click();
    await expect(page.getByRole('option')).toHaveText(['Room', 'Pax', 'Unit']);
    await page.keyboard.press('Escape');
    await p.byValue('Standalone and in packages').click();
    await expect(page.getByRole('option')).toHaveText(['Standalone and in packages', 'Standalone only', 'Packages only']);
  });

  test('TC-PRD-07: Add room - defaults: B2B and B2C on, Ad-hoc off, Charged per Room, Core-default occupancies Double 2+2+2 and Single', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await expect(p.toggle('Sell to agents (B2B)')).toBeChecked();
    await expect(p.toggle('Sell to travellers (B2C)')).toBeChecked();
    await expect(p.toggle('Ad-hoc bookings')).not.toBeChecked();
    await expect(p.byValue('Room')).toBeVisible();
    await expect(page.locator('main input[value="Double"]')).toBeVisible();
    await expect(page.locator('main input[value="Single"]')).toBeVisible();
    await expect(page.getByText('Core default').first()).toBeVisible();
  });

  test('TC-PRD-08: Add room - bed types Bunk / Double / King / Single / Twin', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await page.locator('main input[value="Double"]').first().click();
    await expect(page.getByRole('option')).toHaveText(['Bunk', 'Double', 'King', 'Single', 'Twin']);
  });

  test('TC-PRD-09: Add room - "Add room" adds an occupancy row and "Remove room" removes it', async () => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await expect(p.occupancyRows().first()).toBeVisible();
    const before = await p.occupancyRows().count();
    await p.addOccupancy().click();
    await expect(p.occupancyRows()).toHaveCount(before + 1);
    await p.page.getByRole('button', { name: 'Remove room' }).last().click();
    await expect(p.occupancyRows()).toHaveCount(before);
  });

  test('TC-PRD-10: Age policy - default Infant 0-2, Child 3-12, Adult 13-99; the next band starts after the previous one', async () => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    for (const [f, v] of [['Infant from', '0'], ['Infant to', '2'], ['Child from', '3'], ['Child to', '12'], ['Adult from', '13'], ['Adult to', '99']] as const) await expect(p.spin(f), f).toHaveValue(v);
    await p.typeNumber(p.spin('Infant to'), '5');
    await expect(p.spin('Child from')).toHaveValue('6');
    await p.typeNumber(p.spin('Child to'), '15');
    await expect(p.spin('Adult from')).toHaveValue('16');
    await expect(p.spin('Child from')).toBeDisabled();
    await expect(p.spin('Adult from')).toBeDisabled();
  });

  test('TC-PRD-11: Age policy - a Child "to" below Child "from" is corrected (no gap or overlap)', async () => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await p.typeNumber(p.spin('Infant to'), '5');
    await p.typeNumber(p.spin('Child to'), '2');
    const childTo = Number(await p.spin('Child to').inputValue());
    expect(childTo).toBeGreaterThanOrEqual(6);
    expect(Number(await p.spin('Adult from').inputValue())).toBe(childTo + 1);
  });

  test('TC-PRD-12: Cancel with unsaved changes asks "Discard unsaved changes?"', async ({ page }) => {
    await p.open(SUP, 'Hotel');
    await p.addButton('Add room').click();
    await p.roomName.fill('QA Auto Room discard');
    await p.cancel.click();
    await expect(page.getByRole('dialog').last()).toContainText('Discard unsaved changes?');
    expect(blocked).toEqual([]);
  });
});

test.describe('Excursion and private transfer', () => {
  test('TC-PRD-20: Excursion lists "Jungle Safari" (Abu Dhabi); it opens read-only with Duplicate / History / Edit', async () => {
    await p.open(SUP, 'Excursion');
    await p.item('Jungle Safari').click();
    await expect(p.productName).toHaveValue('Jungle Safari', { timeout: 30_000 });
    await expect(p.productName).toBeDisabled();
    for (const b of [p.duplicate, p.history, p.edit]) await expect(b).toBeVisible();
  });

  test('TC-PRD-21: Excursion "Jungle Safari" has 2 pax bands (1-10, 11-12)', async () => {
    await p.open(SUP, 'Excursion');
    await p.item('Jungle Safari').click();
    await expect(p.spin('Band 1 from')).toHaveValue('1');
    await expect(p.spin('Band 1 to')).toHaveValue('10');
    await expect(p.spin('Band 2 from')).toHaveValue('11');
    await expect(p.spin('Band 2 to')).toHaveValue('12');
  });

  for (const [product, add] of [['Excursion', 'Add excursion'], ['Private transfer', 'Add private transfer']] as const) {
    test(`TC-PRD-22: ${product} - empty Create says "Enter a product name." and sends nothing`, async ({ page }) => {
      await p.open(SUP, product);
      await p.addButton(add).click();
      await p.create.click();
      await expect(page.getByText('Enter a product name.').first()).toBeVisible();
      expect(blocked).toEqual([]);
    });

    test(`TC-PRD-23: ${product} - Service on (Service / Pax) and Service by (Pax / Service / Day)`, async ({ page }) => {
      await p.open(SUP, product);
      await p.addButton(add).click();
      await p.byValue('Service').click();
      await expect(page.getByRole('option')).toHaveText(['Service', 'Pax']);
      await page.keyboard.press('Escape');
      await p.byValue('Pax').click();
      await expect(page.getByRole('option')).toHaveText(['Pax', 'Service', 'Day']);
    });

    test(`TC-PRD-24: ${product} - Max capacity 0 is refused ("Max capacity must be at least 1.")`, async ({ page }) => {
      await p.open(SUP, product);
      await p.addButton(add).click();
      await p.productName.fill(`QA Auto ${product} capacity`);
      await p.typeNumber(page.locator('main input[type=number][placeholder="1"]').first(), '0');
      await p.create.click();
      await expect(page.getByText('Max capacity must be at least 1.').first()).toBeVisible();
      expect(blocked).toEqual([]);
    });

    test(`TC-PRD-25: ${product} - Height max below min is refused ("Max can't be lower than min.")`, async ({ page }) => {
      await p.open(SUP, product);
      await p.addButton(add).click();
      await p.productName.fill(`QA Auto ${product} height`);
      await page.getByPlaceholder('Min').fill('200');
      await page.getByPlaceholder('Max').fill('100');
      await p.create.click();
      await expect(page.getByText("Max can't be lower than min.").first()).toBeVisible();
      expect(blocked).toEqual([]);
    });
  }

  test('TC-PRD-26: Private transfer - a supplier without transfers shows "No private transfer yet"', async ({ page }) => {
    await p.open(SUP, 'Private transfer');
    const empty = page.getByText(/No private transfer yet/);
    await expect(empty.or(page.locator('main button:visible', { hasText: /^QA Auto Transfer/ }).first())).toBeVisible({ timeout: 30_000 });
    if (await empty.isVisible()) await expect(p.filter('All')).toBeDisabled();
    else expect(await p.count('All')).toBeGreaterThan(0);
  });

  test('TC-PRD-27: Excursion - pax bands run on from each other (Band 2 starts after Band 1, its "From" is locked)', async ({ page }) => {
    await p.open(SUP, 'Excursion');
    await p.addButton('Add excursion').click();
    await page.locator('main button:visible', { hasText: /^Add pax band$/ }).click();
    await page.locator('main button:visible', { hasText: /^Add pax band$/ }).click();
    await expect(p.spin('Band 1 from')).toHaveValue('1');
    await expect(p.spin('Band 1 from')).toBeDisabled();
    await p.typeNumber(p.spin('Band 1 to'), '10');
    await expect(p.spin('Band 2 from')).toHaveValue('11');
    await expect(p.spin('Band 2 from')).toBeDisabled();
    await expect(page.getByText(/Bands run on from each other/)).toBeVisible();
  });

});
