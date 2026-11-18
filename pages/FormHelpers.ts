import { Locator, Page, Response, expect, test } from '@playwright/test';

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

// ------------------------------------------------------------------ shared by every module

/** First VISIBLE match (hidden in-app tabs keep copies of screens in the page) */
export const visible = (l: Locator): Locator => l.locator('visible=true').first();

/** Visible button whose whole text is `name` (default scope: <main>) */
export function buttonNamed(scope: Page | Locator, name: string): Locator {
  const root = 'locator' in scope && 'goto' in scope ? (scope as Page).locator('main') : scope as Locator;
  return root.locator('button:visible', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\−-]/g, '\\$&')}$`) }).first();
}

/** Body of the open dialog (in this app role=dialog only wraps the title, so use the MUI paper) */
export const openDialog = (page: Page): Locator => page.locator('.MuiDialog-paper:visible').last();

/**
 * Click, then wait for the save request whose URL matches `what`; returns the reply (logged), or null if none came.
 *   required: true -> fail the test when no save request is seen
 */
export async function waitForSave(page: Page, click: () => Promise<unknown>, what: RegExp,
  opts: { timeout?: number; methods?: string[]; required?: boolean; skip?: RegExp } = {}): Promise<Response | null> {
  const methods = opts.methods ?? ['POST', 'PUT', 'PATCH', 'DELETE'];
  const res = page.waitForResponse(r => methods.includes(r.request().method()) && what.test(r.url()) && !(opts.skip && opts.skip.test(r.url())),
    { timeout: opts.timeout ?? 30_000 }).catch(e => { if (opts.required) throw e; return null; });
  await click();
  const r = await res;
  if (r) console.log(`SAVE ${r.request().method()} ${r.url()} -> ${r.status()} ${r.ok() ? '' : (await r.text().catch(() => '')).slice(0, 200)}`);
  return r;
}

/** Bug evidence: outline each target in red, screenshot to screenshots/bugs/<file>.png and attach it to the report */
export async function bugShot(page: Page, file: string, ...targets: Locator[]) {
  for (const t of targets) await t.first().evaluate(el => { (el as HTMLElement).style.outline = '4px solid red'; (el as HTMLElement).style.outlineOffset = '2px'; }, undefined, { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const path = `screenshots/bugs/${file}.png`;
  await page.screenshot({ path });
  await test.info().attach(file, { path, contentType: 'image/png' });
}
