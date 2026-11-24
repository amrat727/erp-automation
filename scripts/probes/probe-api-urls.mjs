// Helper (not a test): READ-ONLY - lists the GET data endpoints each screen calls (to build the Dashboard check).
//   node scripts/probes/probe-api-urls.mjs
import { open } from '../lib/probe-lib.mjs';

const { browser, page } = await open({});
page.setDefaultTimeout(30000);
let urls = [];
page.on('response', r => { if (r.request().method() === 'GET' && /pilottest/.test(r.url()) && /json/.test(r.headers()['content-type'] || '')) urls.push(r.url().replace(/^https:\/\/[^/]+/, '')); });
const skip = /auth|userdetails|configurations\/values|chat|notification|countries|currencies|lookups|menus|statuses\/active|branches|agents\?page=1&pageSize=1000/;
const show = n => { console.log(`== ${n}\n   ${[...new Set(urls)].filter(u => !skip.test(u)).join('\n   ')}`); urls = []; };
await page.goto('/contracts'); await page.waitForTimeout(8000); show('contracts list');
await page.goto('/feedback'); await page.waitForTimeout(8000); show('feedback list');
await page.goto('/reservations'); await page.waitForTimeout(6000); urls = [];
await page.locator('tbody tr').first().locator('td').nth(1).click(); await page.waitForTimeout(8000); show('reservation detail');
await page.goto('/suppliers/2/overview'); await page.waitForTimeout(8000); show('supplier detail (Marina Bay)');
await page.goto('/suppliers/2/products'); await page.waitForTimeout(6000);
await page.getByRole('button', { name: /^Hotel/ }).first().click().catch(() => {}); await page.waitForTimeout(4000); urls = [];
await page.getByRole('tab', { name: /Allotment/i }).first().click().catch(() => {}); await page.waitForTimeout(8000); show('Marina Bay allotments');
await browser.close();
