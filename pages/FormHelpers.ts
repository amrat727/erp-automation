import { Locator, Page, expect } from '@playwright/test';

/**
 * Small helpers for screens that are NOT standard master lists (journals, invoices, settings...).
 */

/** Input that follows a visible label like "Narration*" (labels are not linked to inputs in this app) */
export function inputAfter(scope: Locator, label: string | RegExp): Locator {
  const re = typeof label === 'string' ? new RegExp(`^${label}\\s*\\*?$`) : label;
  return scope.getByText(re).first().locator('xpath=following::input[1]');
}

/** Wait until a page's heading is shown (the free server can be slow) */
export async function openPage(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 60_000 });
}

/** The last open dialog with this title */
export function dialogTitled(page: Page, title: string | RegExp): Locator {
  return page.getByRole('dialog').filter({ hasText: title }).last();
}
