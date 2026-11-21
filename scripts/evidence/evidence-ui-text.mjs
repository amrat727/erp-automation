// Helper (not a test): READ-ONLY screenshots for the UI-text bugs BUG-136..146 (reports/Linear/ui-text-bugs.json).
// Every save is BLOCKED by probe-lib. Outlines (3px red) each visible element in main / nav whose trimmed text
// EXACTLY equals one of the bug's outline texts. Screenshots -> screenshots/ui-text/<id>.png
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';
const bugs = JSON.parse(fs.readFileSync('reports/Linear/ui-text-bugs.json', 'utf-8'));
// BUG-138: on the 21 Nov build the '#' labels are only on the Company page (Supplier > Financials shows plain PAN / TAN)
const override = { 'BUG-138': { shotUrl: '/companies/2', outline: ['Phone#', 'PAN#', 'TAN#'] } };
for (const b of bugs) Object.assign(b, override[b.id] || {});
const only = process.argv.slice(2);
const log = [];
const { browser, page } = await open({ log });
fs.mkdirSync('screenshots/ui-text', { recursive: true });
const results = [];
for (const b of bugs) {
  if (only.length && !only.includes(b.id)) continue;
  await page.goto(b.shotUrl);
  await page.waitForTimeout(3500);
  if (/\/login/.test(page.url())) { console.log('SESSION EXPIRED (redirected to /login)'); results.push({ id: b.id, expired: true }); break; }
  const found = await page.evaluate((texts) => {
    const roots = [...document.querySelectorAll('main, nav, aside, header')];
    const hits = {};
    for (const t of texts) hits[t] = 0;
    const norm = e => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const seen = new Set();
    for (const r of roots) for (let el of r.querySelectorAll('*')) {
      const s = norm(el);
      if (!(s in hits)) continue;
      // innermost element with this exact text, then its button / link / tab if that has the same text
      if ([...el.children].some(c => norm(c) === s)) continue;
      const btn = el.closest('button, a, [role=button], [role=tab], label');
      if (btn && norm(btn) === s) el = btn;
      if (seen.has(el)) continue; seen.add(el);
      const rect = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!rect.width || !rect.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
      el.dataset.uiTextHit = s;
      const isBtn = el.matches('button, a, [role=button], [role=tab]');
      el.style.outline = '3px solid red'; el.style.outlineOffset = isBtn ? '-3px' : '1px';
      hits[s]++;
    }
    const all = [...document.querySelectorAll('[data-ui-text-hit]')];
    // bring off-screen hits into view (inner scroll panels first, nearest edge so the others stay visible)
    for (const e of all) { const r = e.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) e.scrollIntoView({ block: 'nearest' }); }
    return hits;
  }, b.outline);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/ui-text/${b.id}.png` });
  const n = Object.values(found).filter(v => v > 0).length;
  console.log(`${b.id} ${b.shotUrl}: ${n}/${b.outline.length} texts found ${JSON.stringify(found)}${n ? '' : '  -> NONE FOUND'}`);
  results.push({ id: b.id, found: n, total: b.outline.length, hits: found });
}
fs.writeFileSync('screenshots/ui-text/results.json', JSON.stringify(results, null, 1));
console.log('requests:', log.join(' | ') || 'none');
await browser.close();
