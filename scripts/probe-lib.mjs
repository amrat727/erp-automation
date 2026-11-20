// Helper (not a test): shared setup for probe scripts. Writes are BLOCKED unless allowWrites is true.
import { chromium } from '@playwright/test';
import fs from 'fs';

// `allow`: POSTs that only READ (searches) and may always go through
export async function open({ allowWrites = false, log = [], allow = /\/(hotel|activity|transfer|flight)s?\/search(\?|$)/ } = {}) {
  const session = fs.readFileSync('playwright/.auth/session.json', 'utf-8');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: process.env.BASE_URL || 'https://erp.nexgenpilot.com', viewport: { width: 1500, height: 950 } });
  await ctx.addInitScript(d => { if (!sessionStorage.getItem('token')) for (const [k, v] of Object.entries(JSON.parse(d))) sessionStorage.setItem(k, v); }, session);
  await ctx.route('**/pilottest.runasp.net/**', r => {
    const q = r.request();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/negotiate|\/auth\//.test(q.url()) && !allow.test(q.url())) {
      log.push(`${allowWrites ? 'SENT' : 'BLOCKED'} ${q.method()} ${q.url().replace(/^https:\/\/[^/]+/, '')} ${(q.postData() || '').slice(0, 400)}`);
      return allowWrites ? r.continue() : r.abort();
    }
    return r.continue();
  });
  const page = await ctx.newPage();
  page.on('response', async res => {
    const q = res.request();
    if (allowWrites && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && /pilottest/.test(res.url()) && !/negotiate|\/auth\//.test(res.url()))
      log.push(`  -> ${res.status()} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  });
  return { browser, ctx, page };
}

export const text = async (page, sel = 'main') => (await page.locator(sel).first().innerText().catch(() => '')).replace(/[\s\u200b]+/g, ' ').trim();
export const buttons = async (page, sel = 'main') => (await page.locator(`${sel} button:visible`).allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
export const SHOTS = process.env.SHOTS || 'C:/Users/TESTAC~1/AppData/Local/Temp/claude/d5c1dc49493c9745/65f7f050-2da9-4d87-bc59-32b2383b69cc/scratchpad';
