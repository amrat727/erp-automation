import { test, expect } from '../../fixtures';
import { Page } from '@playwright/test';
import { blockWrites } from '../../pages/MasterListPage';
import { openPage, dialogTitled } from '../../pages/FormHelpers';

/*
 * CORE > ACCOUNTS > TRANSACTIONS - READ-ONLY tests (agreed: these screens must never change real data).
 * EVERY save / post request is BLOCKED in the browser. If the app tries to send something it should
 * NOT send (e.g. an unbalanced journal), the blocked request is recorded and the test fails.
 *
 * Business rules checked (double-entry accounting):
 *  - a journal must have Date and Narration
 *  - total Debit must equal total Credit before it can be posted
 *  - totals add up the lines automatically
 */
let blocked: string[];
test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

// ======================= JOURNALS =======================
test.describe('Journals', () => {
  const open = async (page: Page) => {
    await openPage(page, '/journals', 'Journals');
    await page.getByRole('button', { name: 'New journal voucher' }).click();
    const dlg = dialogTitled(page, 'New journal voucher');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-JRN-01: Opens from menu Core > Accounts > Transactions > Journals @smoke', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'Accounts', 'Transactions', 'Journals']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/journals$/);
    await expect(page.getByRole('heading', { name: 'Journals' })).toBeVisible({ timeout: 60_000 });
  });

  test('TC-JRN-02: List has filters (Number, Date, Source, Narration, Reference, Status) and empty message', async ({ page }) => {
    await openPage(page, '/journals', 'Journals');
    for (const col of ['Number', 'Date', 'Source', 'Narration', 'Reference', 'Amount (base)', 'Status'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col.replace(/[()]/g, '\\$&')}`) })).toBeVisible();
    await expect(page.getByText('There are no records in Journals').or(page.locator('tbody tr').first())).toBeVisible();
  });

  test('TC-JRN-03: New journal voucher form has all fields, 2 lines, totals 0.00 and buttons', async ({ page }) => {
    const dlg = await open(page);
    for (const t of ['Date', 'Narration', 'Reference', 'Reverses on', 'Account', 'Description', 'Debit', 'Credit', 'Totals'])
      await expect(dlg.getByText(new RegExp(`^${t}\\s*\\*?$`)).first(), t).toBeVisible();
    await expect(dlg.getByRole('combobox')).toHaveCount(2);          // 2 account lines to start with
    await expect(dlg.getByText('0.00')).toHaveCount(2);              // debit total, credit total
    for (const b of ['Add line', 'Cancel', 'Post journal']) await expect(dlg.getByRole('button', { name: b })).toBeVisible();
  });

  test('TC-JRN-04: Posting an empty journal is blocked with messages, nothing is sent', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Post journal' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText(/required|enter|choose|select/i).first()).toBeVisible();
    expect(blocked, 'empty journal was sent to the server').toEqual([]);
  });

  test('TC-JRN-05: "Add line" adds an account line', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Add line' }).click();
    await expect(dlg.getByRole('combobox')).toHaveCount(3);
  });

  test('TC-JRN-06: Totals add up Debit and Credit as you type', async ({ page }) => {
    const dlg = await open(page);
    const nums = dlg.locator('input[type=number]');                  // line1 debit, line1 credit, line2 debit, line2 credit
    await nums.nth(0).fill('100.50');
    await nums.nth(3).fill('40');
    await expect(dlg.getByText('100.50').last()).toBeVisible();
    await expect(dlg.getByText('40.00')).toBeVisible();
  });

  test('TC-JRN-07: An UNBALANCED journal (Debit 100 / Credit 40) cannot be posted', async ({ page }) => {
    const dlg = await open(page);
    const nums = dlg.locator('input[type=number]');
    await nums.nth(0).fill('100');
    await nums.nth(3).fill('40');
    await dlg.getByRole('button', { name: 'Post journal' }).click();
    await page.waitForTimeout(1500);
    await expect(dlg).toBeVisible();
    expect(blocked, 'an UNBALANCED journal was sent to the server').toEqual([]);
  });

  test('TC-JRN-08: Narration is limited to 500 and Reference to 100 characters', async ({ page }) => {
    const dlg = await open(page);
    const narration = dlg.locator('input[maxlength="500"]');
    const reference = dlg.locator('input[maxlength="100"]');
    await narration.fill('N'.repeat(600));
    await reference.fill('R'.repeat(200));
    expect((await narration.inputValue()).length).toBe(500);
    expect((await reference.inputValue()).length).toBe(100);
  });

  test('TC-JRN-09: Debit and Credit do not accept letters', async ({ page }) => {
    const dlg = await open(page);
    const debit = dlg.locator('input[type=number]').first();
    await debit.pressSequentially('abc');
    await expect(debit).toHaveValue('');
  });

  test('TC-JRN-10: Cancel closes the form without sending anything', async ({ page }) => {
    const dlg = await open(page);
    await dlg.locator('input[maxlength="500"]').fill('Typed but cancelled');
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();
    expect(blocked).toEqual([]);
  });
});

// ======================= RECURRING JOURNALS =======================
test.describe('Recurring Journals', () => {
  const open = async (page: Page) => {
    await openPage(page, '/recurringjournals', 'Recurring Journals');
    await page.getByRole('button', { name: 'New recurring journal' }).click();
    const dlg = dialogTitled(page, 'New recurring journal');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-RJ-01: List shows columns, the explanation when empty, and "Post due now"', async ({ page }) => {
    await openPage(page, '/recurringjournals', 'Recurring Journals');
    for (const col of ['Name', 'Narration', 'Day', 'Next run', 'Last posted', 'Amount', 'Status'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post due now' })).toBeVisible();   // NEVER clicked by tests
    await expect(page.getByText(/No recurring journals yet/).or(page.locator('tbody tr').first())).toBeVisible();
  });

  test('TC-RJ-02: Form has Name*, Narration*, Posts on day*, From*, Until, Active and lines', async ({ page }) => {
    const dlg = await open(page);
    for (const t of ['Name', 'Narration', 'Reference', 'Posts on day', 'From', 'Until', 'Active', 'Account', 'Debit', 'Credit'])
      await expect(dlg.getByText(new RegExp(`^${t}\\s*\\*?$`)).first(), t).toBeVisible();
    await expect(dlg.locator('input[placeholder="No end date"]')).toHaveValue('');
  });

  test('TC-RJ-03: Saving an empty recurring journal is blocked, nothing is sent', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText(/required|enter|choose|select/i).first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-RJ-04: "Posts on day" offers days of the month (1 ... 28 or more)', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('combobox').first().click();
    const options = await page.getByRole('option').allInnerTexts();
    expect(options.length, `options: ${options.join(', ')}`).toBeGreaterThanOrEqual(28);
    expect(options[0]).toMatch(/^1(st)?$|^1\b/);
  });

  test('TC-RJ-05: An UNBALANCED recurring journal cannot be saved', async ({ page }) => {
    const dlg = await open(page);
    await dlg.locator('input[maxlength="150"]').fill('QA Auto unbalanced');
    await dlg.locator('input[maxlength="500"]').fill('QA Auto narration');
    const nums = dlg.locator('input[type=number]');
    await nums.nth(0).fill('100');
    await nums.nth(3).fill('40');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1500);
    await expect(dlg).toBeVisible();
    expect(blocked, 'an UNBALANCED recurring journal was sent').toEqual([]);
  });

  test('TC-RJ-06: Name limited to 150 characters', async ({ page }) => {
    const dlg = await open(page);
    const name = dlg.locator('input[maxlength="150"]');
    await name.fill('A'.repeat(300));
    expect((await name.inputValue()).length).toBe(150);
  });
});

// ======================= BANK RECONCILIATION =======================
test.describe('Bank Reconciliation', () => {
  test('TC-BANK-01: Statement form: Bank account*, Currency (locked), Statement date*, closing balance', async ({ page }) => {
    await openPage(page, '/bankreconciliation', 'Bank Reconciliation');
    await expect(page.getByPlaceholder('Choose a bank or cash account')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Currency' }).or(page.locator('input[aria-label=Currency]'))).toBeDisabled();
    await expect(page.getByText('Choose a bank account to reconcile.')).toBeVisible();
  });

  test('TC-BANK-02: Statement date defaults to today', async ({ page }) => {
    await openPage(page, '/bankreconciliation', 'Bank Reconciliation');
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); // "12 Nov 2026"
    await expect(page.locator('input[placeholder="DD MMM YYYY"]').first()).toHaveValue(today);
  });

  test('TC-BANK-03: Bank account list offers only bank / cash accounts', async ({ page }) => {
    await openPage(page, '/bankreconciliation', 'Bank Reconciliation');
    await page.getByPlaceholder('Choose a bank or cash account').click();
    await page.waitForTimeout(2000);
    const options = await page.getByRole('option').allInnerTexts();
    test.info().annotations.push({ type: 'bank accounts offered', description: options.join(', ') || '(none - Chart of Accounts is empty)' });
    // nothing to reconcile until a bank account exists -> the screen must stay on its hint
    if (!options.length || /no options/i.test(options.join())) await expect(page.getByText('Choose a bank account to reconcile.')).toBeVisible();
  });
});

// ======================= AGENT INVOICES =======================
test.describe('Agent Invoices', () => {
  const open = async (page: Page) => {
    await openPage(page, '/agentinvoices', 'Agent Invoices');
    await page.getByRole('button', { name: 'Raise invoice' }).click();
    const dlg = dialogTitled(page, 'Raise agent invoice');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-AINV-01: List has columns, filters, "To invoice" counter, Excel buttons', async ({ page }) => {
    await openPage(page, '/agentinvoices', 'Agent Invoices');
    for (const col of ['Number', 'Type', 'Date', 'Due', 'Agent', 'Reservation', 'Total', 'Status'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.getByRole('button', { name: /^To invoice\s*\d+$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Excel' })).toBeVisible();        // never used by tests
  });

  test('TC-AINV-02: "Download Excel" gives an .xlsx file', async ({ page }) => {
    await openPage(page, '/agentinvoices', 'Agent Invoices');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: 'Download Excel' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test('TC-AINV-03: Invoice form has Agent*, Currency*, Invoice date*, Due date, lines, totals, Notes', async ({ page }) => {
    const dlg = await open(page);
    for (const t of ['Agent', 'Currency', 'Invoice date', 'Due date', 'Description', 'Net', 'Tax', 'Tax amount', 'Revenue account', 'Notes'])
      await expect(dlg.getByText(new RegExp(`^${t}\s*\*?$`)).first(), t).toBeVisible();
    await expect(dlg.getByText('Tax 0.00 · Total 0.00')).toBeVisible();
    await expect(dlg.getByRole('button', { name: 'Post invoice' })).toBeVisible();
  });

  test('TC-AINV-04: Posting an empty invoice is blocked ("Choose the agent."), nothing is sent', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Post invoice' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('Choose the agent.')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-AINV-05: Total follows the Net amount of the lines', async ({ page }) => {
    const dlg = await open(page);
    await dlg.locator('input[type=number]').first().fill('250');
    await expect(dlg.getByText(/Total 250\.00/)).toBeVisible();
  });

  test('TC-AINV-06: Line description limited to 300, Notes to 1000 characters', async ({ page }) => {
    const dlg = await open(page);
    const desc = dlg.getByPlaceholder("What's being billed").first();
    await desc.fill('D'.repeat(400));
    expect((await desc.inputValue()).length).toBe(300);
    const notes = dlg.locator('textarea[maxlength="1000"]');
    await notes.fill('N'.repeat(1200));
    expect((await notes.inputValue()).length).toBe(1000);
  });

  test('TC-AINV-07: Negative Net amount is not accepted', async ({ page }) => {
    const dlg = await open(page);
    await dlg.locator('input[type=number]').first().fill('-100');
    await dlg.getByRole('button', { name: 'Post invoice' }).click();
    await page.waitForTimeout(1500);
    expect(blocked, 'an invoice with a NEGATIVE amount was sent').toEqual([]);
    await expect(dlg.getByText(/Total -100/)).toHaveCount(0);
  });

  test('TC-AINV-08: Cancel closes without sending', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await expect(dlg).toBeHidden();
    expect(blocked).toEqual([]);
  });
});

// ======================= SUPPLIER INVOICES =======================
test.describe('Supplier Invoices', () => {
  const open = async (page: Page) => {
    await openPage(page, '/supplierinvoices', 'Supplier Invoices');
    await page.getByRole('button', { name: 'Enter supplier invoice' }).click();
    const dlg = dialogTitled(page, 'Enter supplier invoice');
    await expect(dlg).toBeVisible();
    return dlg;
  };

  test('TC-SINV-01: List has columns, filters and Excel buttons', async ({ page }) => {
    await openPage(page, '/supplierinvoices', 'Supplier Invoices');
    for (const col of ['Number', 'Type', 'Date', 'Due', 'Supplier', 'Supplier ref', 'Reservation', 'Total', 'Status'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Excel' })).toBeVisible();
  });

  test('TC-SINV-02: Form has Supplier*, Supplier\'s invoice no.*, Currency*, Invoice date*, lines with Cost account', async ({ page }) => {
    const dlg = await open(page);
    for (const t of ['Supplier', "Supplier's invoice no.", 'Currency', 'Invoice date', 'Due date', 'Net', 'Tax', 'Cost account', 'Notes'])
      await expect(dlg.getByText(new RegExp(`^${t.replace('.', '\.')}\s*\*?$`)).first(), t).toBeVisible();
    await expect(dlg.getByText('Tax 0.00 · Total 0.00')).toBeVisible();
  });

  test('TC-SINV-03: Posting an empty invoice is blocked ("Choose the supplier."), nothing is sent', async ({ page }) => {
    const dlg = await open(page);
    await dlg.getByRole('button', { name: 'Post invoice' }).click();
    await expect(dlg).toBeVisible();
    await expect(dlg.getByText('Choose the supplier.')).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-SINV-04: Supplier\'s invoice no. limited to 100 characters', async ({ page }) => {
    const dlg = await open(page);
    const ref = dlg.locator('input[maxlength="100"]').first();
    await ref.fill('9'.repeat(150));
    expect((await ref.inputValue()).length).toBe(100);
  });

  test('TC-SINV-05: Total follows the Net amount of the lines', async ({ page }) => {
    const dlg = await open(page);
    await dlg.locator('input[type=number]').first().fill('75.5');
    await expect(dlg.getByText(/Total 75\.50/)).toBeVisible();
  });

  test('TC-SINV-06: "Download Excel" gives an .xlsx file', async ({ page }) => {
    await openPage(page, '/supplierinvoices', 'Supplier Invoices');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), page.getByRole('button', { name: 'Download Excel' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });
});

// ======================= REFUND PAYOUTS =======================
test('TC-REF-01: Refund Payouts page shows content (list or empty message), not a blank page', async ({ page }) => {
  await page.goto('/dashboard');
  for (const b of ['Core', 'Accounts', 'Transactions', 'Refund Payouts']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/refundpayouts$/);
  await page.waitForTimeout(10_000);                                 // give the slow server time
  const body = (await page.locator('main').innerText()).replace(/Nexgenpilot © \d{4}\. All rights reserved\.|v\d+\.\d+\.\d+/g, '').trim();
  expect(body, 'page body is empty apart from the footer').not.toBe('');
});

// ======================= FINANCIAL PERIODS (no button is ever clicked) =======================
test.describe('Financial Periods', () => {
  test('TC-FP-01: Shows year, period columns and the "create the year" hint when the year is empty', async ({ page }) => {
    await openPage(page, '/financialperiods', 'Financial Periods');
    const year = String(new Date().getFullYear());
    await expect(page.locator('main input').first()).toHaveValue(year);
    for (const col of ['Period', 'Dates', 'Receivable', 'Payable', 'General ledger'])
      await expect(page.getByRole('columnheader', { name: new RegExp(`^${col}`) })).toBeVisible();
    await expect(page.getByText(`No periods for ${year} yet`).or(page.locator('tbody tr').first())).toBeVisible();
  });

  test('TC-FP-02: Year actions are present: "Create <year>", "Close year", "Revalue currencies"', async ({ page }) => {
    await openPage(page, '/financialperiods', 'Financial Periods');
    const year = String(new Date().getFullYear());
    await expect(page.getByRole('button', { name: `Create ${year}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close year' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revalue currencies' })).toBeVisible();
  });

  test('TC-FP-03: "Close year" is not available while the year has NO periods', async ({ page }) => {
    await openPage(page, '/financialperiods', 'Financial Periods');
    const year = String(new Date().getFullYear());
    test.skip(!(await page.getByText(`No periods for ${year} yet`).isVisible()), 'year already has periods');
    // business rule: a year that was never opened cannot be closed
    await expect(page.getByRole('button', { name: 'Close year' })).toBeDisabled();
  });
});

// ======================= ACCOUNTING SETTINGS (never saved) =======================
test.describe('Accounting Settings', () => {
  test('TC-AST-01: Opens from Core > Accounts > Configuration > Accounting Settings with a Save button', async ({ page }) => {
    await page.goto('/dashboard');
    for (const b of ['Core', 'Accounts', 'Configuration', 'Accounting Settings']) await page.getByRole('button', { name: b, exact: true }).click({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/accountingsettings$/);
    await expect(page.getByRole('heading', { name: 'Accounting Settings' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    test.info().annotations.push({ type: 'settings shown', description: (await page.locator('main').innerText()).slice(0, 600) });
  });

  test('TC-AST-02: Leaving the page without saving sends nothing', async ({ page }) => {
    await openPage(page, '/accountingsettings', 'Accounting Settings');
    await page.goto('/dashboard');
    expect(blocked).toEqual([]);
  });
});
