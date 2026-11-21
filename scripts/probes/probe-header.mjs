// read-only: can the hidden Name search be used directly (force fill) / by clicking the column title area?
import { open } from '../lib/probe-lib.mjs';
const { browser, page } = await open({ log: [] });
const box = page.locator('main thead input[placeholder="Search name"]').first();
const st = async (t) => console.log(t, 'visible', await box.isVisible(), 'box', JSON.stringify(await box.boundingBox()), 'css', await box.evaluate(e => { let s = '', n = e; for (let i = 0; i < 5 && n; i++, n = n.parentElement) { const c = getComputedStyle(n); s += `${c.display}/${c.visibility}/${c.opacity}/${c.width} `; } return s; }), 'rows', await page.locator('tbody tr').count());
await page.goto('/amenities'); await page.locator('tbody tr').first().waitFor({ timeout: 60000 }); await page.waitForTimeout(2000);
await st('fresh');
await box.fill('Air', { force: true }).catch(e => console.log('force fill err', String(e).split('\n')[0]));
await page.waitForTimeout(2500); await st('after force fill'); console.log('names', JSON.stringify((await page.locator('tbody tr td:nth-child(1)').allInnerTexts()).slice(0, 5)));
await page.goto('/amenities'); await page.locator('tbody tr').first().waitFor({ timeout: 60000 }); await page.waitForTimeout(2000);
await page.locator('thead th').first().click({ position: { x: 40, y: 20 }, force: true }); await page.waitForTimeout(1000); await st('after title-area click');
await page.locator('thead th').first().locator('span[aria-hidden=true]').first().click({ force: true }); await page.waitForTimeout(1000); await st('after icon click');
await page.locator('thead th').first().locator('span[aria-hidden=true]').first().click({ force: true }); await page.waitForTimeout(1000); await st('after 2nd icon click');
await browser.close();
