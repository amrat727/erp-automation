# Lesson 1: Your first test

## What is automation testing?

A **test** is a small program that does what a human tester does:
open the website, click, type, and **check** that the result is what we expected.
Playwright is a tool that controls a real browser (Chrome) from code.

Code is written in **TypeScript** (JavaScript with types). Files ending in `.spec.ts` are tests.

## The code (`tests/01-smoke.spec.ts`)

```ts
import { test, expect } from '@playwright/test';
```
**import** = "borrow tools from a library". We borrow two:
- `test` - to create a test
- `expect` - to check something ("I expect the page to show X")

```ts
test('ERP opens and redirects to the login page', async ({ page }) => {
```
- `'ERP opens and...'` is the test's **name** (shown in reports).
- `async ({ page }) => { ... }` is the **body**: the steps. Playwright hands us a
  fresh browser tab called `page`.
- `async` means "this code contains steps that take time" (loading pages, clicking).

```ts
  await page.goto('/');
```
Open the website. `'/'` means the home page of the `baseURL` set in
`playwright.config.ts` (https://erp.nexgenpilot.com).
**`await`** = "wait until this step finishes before the next one". Almost every
Playwright line starts with `await`. Forgetting it is the #1 beginner bug.

```ts
  await expect(page).toHaveURL(/\/login/);
```
Check: the address bar contains `/login`. (`/\/login/` is a *regular expression*,
a search pattern; here it simply means "contains /login".)

```ts
  await expect(page.getByPlaceholder('Code')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
```
`page.getByPlaceholder('Code')` is a **locator**: a way to *find* an element.
- `getByPlaceholder` finds an input by its grey hint text.
- `getByRole('button', { name: 'Sign in' })` finds a button by what a user sees on it.

`toBeVisible()` checks it is on screen. `expect` **retries automatically**
(up to 20s here), so a slow page does not break the test.

```ts
  await page.screenshot({ path: 'screenshots/login-page.png' });
```
Save a picture of the page.

## Run it yourself

Open a terminal in this folder and run:

```bash
npx playwright test tests/01-smoke.spec.ts --project=login
```

Watch the browser do it (headed):

```bash
npx playwright test tests/01-smoke.spec.ts --project=login --headed
```

Best for learning: **UI mode** - click a test, see every step with a picture:

```bash
npx playwright test --ui
```

## Exercises

1. **Break it on purpose.** Change `'Sign in'` to `'Log in'` and run again.
   Read the error: it tells you which locator was not found. Then change it back.
2. **Add a check.** The login page has a "Forgot password?" link. Add:
   ```ts
   await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
   ```
3. **Discover locators without typing.** Run
   ```bash
   npx playwright codegen https://erp.nexgenpilot.com
   ```
   Click around: Playwright writes the code for you. Look at which locators it picks.

## Key words learned
test, expect, page, await, locator, getByRole, getByPlaceholder, toBeVisible, toHaveURL, headed, UI mode, codegen
