# ERP Automation Course: from beginner to your own test suite

We learn by reading **this project's real code**. Each lesson explains one or two files,
then you run them yourself and do a small exercise.

| # | Lesson | Files | You will learn |
|---|--------|-------|----------------|
| 1 | Your first test | `tests/01-smoke.spec.ts` | What a test is, `page`, `goto`, `expect`, locators, how to run |
| 2 | The settings file | `playwright.config.ts`, `.env` | baseURL, timeouts, screenshots/videos, projects, secrets |
| 3 | Page Objects | `pages/LoginPage.ts` | Classes, keeping locators in one place, reusable actions |
| 4 | Login tests | `tests/02-login-negative.spec.ts`, `03-login-positive.spec.ts` | Positive vs negative tests, `describe`, waiting for server responses |
| 5 | Log in once, reuse it | `tests/auth.setup.ts`, `fixtures.ts` | Setup projects, sessions, fixtures |
| 6 | One screen, many tests | `pages/MasterListPage.ts`, `tests/core/country.spec.ts` | Tables, dialogs, filters, search |
| 7 | Data-driven tests | `tests/core/*.config.ts`, `master-ui.ts`, `master-crud.ts` | One test written once, run on 17 screens; `test.fail` for known bugs |
| 8 | Debugging | (any failing test) | UI mode, trace viewer, headed + slow motion, codegen |
| 9 | Reporting | `scripts/bug-report.js` | Turning results into an Excel bug report |
| 10 | Your turn | a new module | Automate a screen yourself with Claude reviewing |

Ask Claude: **"next lesson"** whenever you are ready.
