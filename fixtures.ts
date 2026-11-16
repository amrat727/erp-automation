import { test as base } from '@playwright/test';
import fs from 'fs';

/*
 * "Fixture" = something Playwright prepares for a test before it starts.
 * This one gives every test a page that is ALREADY LOGGED IN, by putting the
 * saved session (from auth.setup.ts) back into sessionStorage.
 *
 * In tests write:   import { test, expect } from '../../fixtures';
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
    await page.addInitScript(data => {
      if (!sessionStorage.getItem('token')) {
        for (const [k, v] of Object.entries(JSON.parse(data))) sessionStorage.setItem(k, v as string);
      }
    }, session);
    await use(page);
  },
});

export { expect } from '@playwright/test';
