// Helper (not a test): READ-ONLY screenshot of the B2B portal login page (nothing is typed or submitted).
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto('https://b2b.nexgenpilot.com/login');
await page.waitForTimeout(6000);
await page.screenshot({ path: 'reports/Round3-Questions/screenshots/B-01-b2b-login.png' });
console.log('title:', await page.title());
console.log('inputs:', JSON.stringify(await page.locator('input:visible').evaluateAll(els => els.map(e => [e.type, e.placeholder, e.name].join('|')))));
console.log('buttons/links:', JSON.stringify((await page.locator('button:visible, a:visible').allInnerTexts()).map(s => s.trim()).filter(Boolean)));
await browser.close();
