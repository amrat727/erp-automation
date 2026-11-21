import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled } from '../../pages/FormHelpers';

/*
 * CORE - screens that do NOT follow the standard "Name list" layout.
 * READ-ONLY: every save is blocked. A test fails if the app sends something it should not.
 *   Application > Feedback Questions, Flex 1-10
 *   Resource    > Resource Mapping
 *   Product     > Excursion Setup
 *   Accounts    > Exchange Rate, Tax Detail
 *   System      > Restriction Groups
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

// ======================= FEEDBACK QUESTIONS =======================
test.describe('Feedback Questions', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/feedback-questions', 'Feedback Questions');
    await page.getByRole('button', { name: 'Add Question' }).click();
    const dlg = dialogTitled(page, 'Add Question');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-FBQ-01: Page explains the questionnaire and shows Questions / Groups counters', async ({ page }) => {
    await openPage(page, '/feedback-questions', 'Feedback Questions');
    await expect(page.getByText(/trip feedback questionnaire/)).toBeVisible();
    // v1.0.2: the counters are tabs "Questions 0" / "Groups 0"
    await expect(page.getByRole('tab', { name: /^Questions \d+$/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Groups \d+$/ })).toBeVisible();
    for (const col of ['Group', 'Order', 'Question', 'Asks about', 'Answer', 'Languages', 'Answers', 'Active'])
      await expect(page.getByRole('columnheader', { name: col, exact: true })).toBeVisible();   // exact: "Answer" vs "Answers"
  });

  test('TC-FBQ-02: Question form offers 4 answer types and 2 "asks about" choices', async ({ page }) => {
    const dlg = await openAdd(page);
    for (const b of ['Rating (1–5)', 'Yes / no', 'Text', 'Choice', 'Whole trip', 'Each service of a kind'])
      await expect(dlg.getByRole('button', { name: b })).toBeVisible();
    await expect(dlg.getByText('Asked once per questionnaire.')).toBeVisible();     // help text for "Whole trip"
  });

  test('TC-FBQ-03: Saving without the English question is blocked with a clear reason', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText("Write the question in English — it's what the form falls back to.").first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-FBQ-04: Missing translation (Hindi) is flagged and falls back to English', async ({ page }) => {
    const dlg = await openAdd(page);
    await expect(dlg.getByText('missing')).toBeVisible();
    await expect(dlg.getByText('No Hindi wording yet — the form shows English in that language.')).toBeVisible();
  });

  test('TC-FBQ-05: English question limited to 500 characters', async ({ page }) => {
    const dlg = await openAdd(page);
    const q = dlg.locator('textarea[maxlength="500"]');
    await q.fill('Q'.repeat(700));
    expect((await q.inputValue()).length).toBe(500);
  });

  test('TC-FBQ-06: "Choice" answer type asks for the choices', async ({ page }) => {
    const dlg = await openAdd(page);
    const before = await dlg.locator('input, textarea').count();
    await dlg.getByRole('button', { name: 'Choice' }).click();
    await expect(async () => expect(await dlg.locator('input, textarea').count()).toBeGreaterThan(before)).toPass({ timeout: 5_000 });
  });
});

// ======================= FLEX 1-10 =======================
test.describe('Flex lists', () => {
  test('TC-FLEX-01: Menu Core > Application > Flex expands into Flex 1 ... Flex 10', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'Application', 'Flex']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    // stage 21 Nov 2026: "Flex 1" with a space (was "Flex1", BUG-37 fixed)
    for (let i = 1; i <= 10; i++) await expect(page.getByRole('button', { name: `Flex ${i}`, exact: true })).toBeVisible();
  });

  for (let i = 1; i <= 10; i++) {
    test(`TC-FLEX-${String(i + 1).padStart(2, '0')}: Flex${i} opens "Flex ${i}" with Add Flex, Bulk Add and columns`, async ({ page }) => {
      await openPage(page, `/flex/${i}`, `Flex ${i}`);
      await expect(page.getByRole('button', { name: 'Add Flex' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Bulk Add' })).toBeVisible();
      for (const col of ['Description', 'Module', 'Active'])
        await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    });
  }

  test('TC-FLEX-12: Menu text "Flex 1" matches the page heading "Flex 1"', async ({ page }) => {
    // BUG-37 fixed 21 Nov 2026 - menu and heading are both "Flex 1"
    await page.goto('/dashboard');
    for (const b of ['Core', 'Application', 'Flex']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Flex 1', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Flex 1', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-FLEX-13: Add Flex with empty form is blocked, nothing is sent', async ({ page }) => {
    await openPage(page, '/flex/1', 'Flex 1');
    await page.getByRole('button', { name: 'Add Flex' }).click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: /^(Save|Create)/ }).first().click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText(/required|enter|choose/i).first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-FLEX-14: Bulk Add opens and can be closed without saving', async ({ page }) => {
    await openPage(page, '/flex/1', 'Flex 1');
    await page.getByRole('button', { name: 'Bulk Add' }).click();
    const dlg = page.getByRole('dialog').last();
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: /Cancel|Close/ }).first().click();
    await expect(dlg).toBeHidden();
    expect(blocked).toEqual([]);
  });

  test('TC-FLEX-15: Unknown Flex number (/flex/11) does not show a broken page', async ({ page }) => {
    test.fail(true, 'BUG-126: /flex/11 opens a working "Flex 11" list although the menu has only Flex 1-10');
    await page.goto('/flex/11');
    await page.waitForTimeout(8000);
    const heading = page.getByRole('heading', { name: 'Flex 11' });
    await expect(heading, '/flex/11 opens as if Flex 11 existed (menu has only 1-10)').toHaveCount(0);
  });
});

// ======================= RESOURCE MAPPING =======================
test.describe('Resource Mapping', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/resourcemapping', 'Resource Mapping');
    await page.getByRole('button', { name: 'Add Mapping' }).click();
    const dlg = dialogTitled(page, 'Add Resource Mapping');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-RMAP-01: List shows Source / Target resource with their type, Primary and Active filters', async ({ page }) => {
    await openPage(page, '/resourcemapping', 'Resource Mapping');
    for (const col of ['Source Resource', 'Target Resource', 'Primary', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    const row = page.locator('tbody tr').filter({ hasText: 'Amrat Choudhary' });
    await expect(row).toContainText('Personnel');
    await expect(row).toContainText('Car');
    await expect(row).toContainText('Asset');
  });

  test('TC-RMAP-02: Form: Source = Personnel, Target = Asset, "Set as primary pairing"', async ({ page }) => {
    const dlg = await openAdd(page);
    await expect(dlg.getByText(/^Source Resource \(Personnel\)\s*\*$/)).toBeVisible();
    await expect(dlg.getByText(/^Target Resource \(Asset\)\s*\*$/)).toBeVisible();
    await expect(dlg.getByText('Set as primary pairing').first()).toBeVisible();
  });

  test('TC-RMAP-03: Saving without both resources is blocked with a clear message', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Select both a source resource and a target resource.').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-RMAP-04: Source list offers ONLY personnel; target list ONLY assets', async ({ page }) => {
    const dlg = await openAdd(page);
    const [source, target] = [dlg.getByRole('combobox').nth(0), dlg.getByRole('combobox').nth(1)];
    await source.click();
    await expect(page.getByRole('option', { name: /Amrat Choudhary/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Car/ })).toHaveCount(0);
    await source.press('Escape');
    await target.click();
    await expect(page.getByRole('option', { name: /^Car/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Amrat Choudhary/ })).toHaveCount(0);
  });

  test('TC-RMAP-05: The SAME pairing that already exists cannot be added twice', async ({ page }) => {
    test.fail(true, 'BUG-125: the same Personnel -> Asset pairing that is already listed is sent again (no "already exists" check in the form)');
    const dlg = await openAdd(page);
    await dlg.getByRole('combobox').nth(0).click();
    await page.getByRole('option', { name: /Amrat Choudhary/ }).click();
    await dlg.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /^Car/ }).click();
    await dlg.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1500);
    // either the screen stops it, or it reaches the (blocked) server -> then the duplicate check is server-only
    expect(blocked, 'duplicate pairing "Amrat Choudhary -> Car" is not stopped in the form').toEqual([]);
    await expect(page.getByText(/already|exists|duplicate/i).first()).toBeVisible();
  });
});

// ======================= EXCURSION SETUP =======================
test.describe('Excursion Setup', () => {
  test('TC-EXC-01: Opens from menu and asks to pick one of the excursions', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'Product', 'Excursion Setup']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/excursion-setup$/);
    await expect(page.getByText('Pick an excursion to set up')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder(/^Pick an excursion \(\d+\)$/)).toBeVisible();
  });

  test('TC-EXC-02: The picker lists as many excursions as its label says', async ({ page }) => {
    await openPage(page, '/excursion-setup', /Excursion setup/i);
    const picker = page.getByPlaceholder(/^Pick an excursion \(\d+\)$/);
    await expect(picker).toBeVisible({ timeout: 60_000 });
    const n = Number((await picker.getAttribute('placeholder'))!.match(/\d+/)![0]);
    await picker.click();
    await expect(page.getByRole('option')).toHaveCount(n);
  });

  test('TC-EXC-03: Choosing an excursion shows its options, timeslots and rates (nothing saved)', async ({ page }) => {
    await openPage(page, '/excursion-setup', /Excursion setup/i);
    const picker = page.getByPlaceholder(/^Pick an excursion \(\d+\)$/);
    await picker.click({ timeout: 60_000 });
    await page.getByRole('option').first().click();
    await expect(page.getByText(/option/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/timeslot|time slot/i).first()).toBeVisible();
    await expect(page.getByText(/rate/i).first()).toBeVisible();
    expect(blocked).toEqual([]);
  });
});

// ======================= EXCHANGE RATE =======================
test.describe('Exchange Rates', () => {
  const openAdd = async (page: Page) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    await page.getByRole('button', { name: 'Add Exchange Rate' }).click();
    const dlg = dialogTitled(page, 'Add Exchange Rate');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-XR-01: List shows Exchange Type, From, To, Rate as "1 X = n Y" and Effective Date', async ({ page }) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    for (const col of ['Exchange Type', 'From', 'To', 'Rate', 'Effective Date', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toContainText(/1 [A-Z]{3}\s*=\s*[\d.,]+ [A-Z]{3}/);
  });

  test('TC-XR-02: Rate column agrees with From / To columns on every row', async ({ page }) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    for (let i = 0; i < await rows.count(); i++) {
      const cells = (await rows.nth(i).locator('td').allInnerTexts()).map(c => c.trim());
      const [, from, to, rate] = cells;
      expect(rate.replace(/\s+/g, ' '), `row ${i + 1}`).toMatch(new RegExp(`^1 ${from} = [\\d.,]+ ${to}$`));
    }
  });

  test('TC-XR-03: Empty Save shows required fields and "Rate must be greater than 0"', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg.getByText('Rate must be greater than 0')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-XR-04: Rate 0 and negative rate are rejected', async ({ page }) => {
    const dlg = await openAdd(page);
    const rate = dlg.locator('input[type=number]');
    for (const v of ['0', '-5']) {
      await rate.fill(v);
      await dlg.getByRole('button', { name: 'Save' }).click();
      await expect(dlg.getByText('Rate must be greater than 0')).toBeVisible();
    }
    expect(blocked).toEqual([]);
  });

  test('TC-XR-05: From and To currency cannot be the same (USD -> USD)', async ({ page }) => {
    const dlg = await openAdd(page);
    await dlg.getByPlaceholder('Exchange Type').click();
    await page.getByRole('option', { name: 'Default Exchange' }).click();
    for (const ph of ['e.g. USD', 'e.g. INR']) {
      await dlg.getByPlaceholder(ph).click();
      await dlg.getByPlaceholder(ph).fill('USD');
      await page.getByRole('option', { name: /USD/ }).first().click();
    }
    await dlg.locator('input[type=number]').fill('1');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1500);
    expect(blocked, 'an exchange rate USD -> USD was sent to the server').toEqual([]);
  });

  test('TC-XR-06: Clicking a row opens "Edit Exchange Rate" with its values; Cancel keeps them', async ({ page }) => {
    await openPage(page, '/exchangerates', 'Exchange Rates');
    await page.locator('tbody tr td').first().click();
    const dlg = dialogTitled(page, 'Edit Exchange Rate');
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    expect(Number(await dlg.locator('input[type=number]').inputValue())).toBeGreaterThan(0);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();
    expect(blocked).toEqual([]);
  });
});

// ======================= TAX DETAIL =======================
test.describe('Tax Detail', () => {
  test('TC-TXD-01: List columns and Type filter', async ({ page }) => {
    await openPage(page, '/taxdetail', 'Tax Detail');
    for (const col of ['Tax', 'State', 'Service Type', 'Type', 'From Date', 'Range From', 'Range To', 'Value', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
  });

  test('TC-TXD-02: Empty Save is checked in the browser (not sent to the server)', async ({ page }) => {
    // BUG-42 fixed 21 Nov 2026: required fields are checked in the browser
    await openPage(page, '/taxdetail', 'Tax Detail');
    await page.getByRole('button', { name: 'Add Tax Detail' }).click();
    const dlg = dialogTitled(page, 'Add Tax Detail');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1500);
    expect(blocked, 'empty form was sent').toEqual([]);
  });

  test('TC-TXD-03: "Range To" smaller than "Range From" is rejected', async ({ page }) => {
    // BUG-42 fixed 21 Nov 2026: nothing is sent
    await openPage(page, '/taxdetail', 'Tax Detail');
    await page.getByRole('button', { name: 'Add Tax Detail' }).click();
    const dlg = dialogTitled(page, 'Add Tax Detail');
    const nums = dlg.locator('input[type=number]');                // Range From, Range To, Value
    await nums.nth(0).fill('1000');
    await nums.nth(1).fill('10');
    await nums.nth(2).fill('5');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1500);
    expect(blocked, 'a range 1000 -> 10 was sent to the server').toEqual([]);
  });
});

// ======================= RESTRICTION GROUPS =======================
test.describe('Restriction Groups', () => {
  test('TC-RG-01: Opens from Core > System > Restriction Group; list has Name, Modules, Active @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'System', 'Restriction Group']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/restrictions$/);
    for (const col of ['Name', 'Modules', 'Active'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-RG-02: Has an "Audit history" button like other screens (access rights must be traceable)', async ({ page }) => {
    // BUG-35 fixed 21 Nov 2026: Audit history is there
    await openPage(page, '/restrictions', 'Restriction Groups');
    await expect(page.getByRole('button', { name: 'Audit history' })).toBeVisible({ timeout: 5_000 });
  });

  test('TC-RG-03: Add Group: empty Name shows "Name is required", nothing is sent', async ({ page }) => {
    await openPage(page, '/restrictions', 'Restriction Groups');
    await page.getByRole('button', { name: 'Add Group' }).click();
    const dlg = dialogTitled(page, 'Add Restriction Group');
    await dlg.getByRole('button', { name: 'Create & Continue' }).click();
    await expect(dlg.getByText('Name is required')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-RG-04: Users still need a Restriction Group although the list is EMPTY', async ({ page }) => {
    await openPage(page, '/restrictions', 'Restriction Groups');
    const empty = await page.getByText('There are no records in Restriction Group').isVisible();
    test.skip(!empty, 'groups exist');
    // business rule check: "Restriction Group*" is REQUIRED on Add User -> with no groups no user can be created
    await page.goto('/users');
    await page.getByRole('button', { name: 'Add User' }).click({ timeout: 60_000 });
    const dlg = dialogTitled(page, 'Add User');
    await dlg.getByText(/^Restriction Group\s*\*$/).locator('xpath=following::input[1]').click();
    await page.waitForTimeout(2000);
    const options = await page.getByRole('option').allInnerTexts();
    test.info().annotations.push({ type: 'groups offered on Add User', description: options.join(', ') || '(none)' });
    expect(options.filter(o => !/no options/i.test(o)).length, 'Add User requires a Restriction Group but none can be picked').toBeGreaterThan(0);
  });
});
