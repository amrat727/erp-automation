// Helper (not a test): READ-ONLY - KAN-152 (BUG-137) "same label written two ways". Every save is BLOCKED.
//   node scripts/probes/probe-kan152.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const OUT = 'screenshots/sahil'; fs.mkdirSync(OUT, { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(30000);
const has = async (t) => page.getByText(t, { exact: true }).count();
const load = async (p) => { await page.goto(p); await page.locator('main').waitFor(); await page.waitForTimeout(5000); };
const out = {};

await load('/reservations');
out['Reservation list: "Amendment requests" (old) / "Amendment Requests"'] = [await has('Amendment requests'), await has('Amendment Requests')];
out['Reservation header: "Data retention" (old) / "Data Retention"'] = [await has('Data retention'), await has('Data Retention')];
await page.screenshot({ path: `${OUT}/KAN-152-reservations.png` });

await load('/financialperiods');
out['Periods: "Recurring journals" / "Recurring Journals"'] = [await has('Recurring journals'), await has('Recurring Journals')];

await load('/status');
await page.getByRole('button', { name: /^Add Status$/i }).click().catch(() => {});
await page.waitForTimeout(2500);
out['Add Status form: "Applies to" (old) / "Applies To"'] = [await has('Applies to'), await has('Applies To')];
await page.screenshot({ path: `${OUT}/KAN-152-add-status.png` });
await page.keyboard.press('Escape');

await load('/resourcetypes');
await page.getByRole('button', { name: /^Add Resource Type$/i }).click().catch(() => {});
await page.waitForTimeout(1500);
await page.getByRole('dialog').last().getByRole('button', { name: /^Save$/i }).click().catch(() => {});
await page.waitForTimeout(1500);
out['Resource Type empty save: "Name is required." (old, full stop) / "Name is required"'] = [await has('Name is required.'), await has('Name is required')];
await page.screenshot({ path: `${OUT}/KAN-152-resource-type-required.png` });
await page.keyboard.press('Escape');

await load('/enquiries');
out['Enquiries tab: "All 0" (old) / "All (0)"'] = [await page.getByText(/^All\s*\d+$/).count(), await page.getByText(/^All \(\d+\)$/).count()];
await load('/playground');
out['Playground tab: "All (0)"'] = [await page.getByText(/^All\s*\d+$/).count(), await page.getByText(/^All \(\d+\)$/).count()];

for (const [k, v] of Object.entries(out)) console.log(`${k}: old=${v[0]} new=${v[1]}`);
await browser.close();
