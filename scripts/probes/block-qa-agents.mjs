// Helper (not a test): sets every "QA Auto Agent ..." that is not Blocked to Blocked (rule: QA agents end Blocked).
// Reads the list (all pages), then opens /agents/<id>/edit of each QA agent (code AG-000NN = id NN).
// Only rows whose name contains "QA Auto Agent" are touched.
//   node scripts/probes/block-qa-agents.mjs
import { open } from '../lib/probe-lib.mjs';

const log = [];
const { browser, page } = await open({ log, allowWrites: true });
page.setDefaultTimeout(30000);
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

async function openAgents() {
  await page.goto('/agents'); await page.locator('tbody tr').first().waitFor({ timeout: 90000 }); await page.waitForTimeout(2000);
  const rows = [];
  for (let p = 0; p < 10; p++) {
    rows.push(...(await page.locator('tbody tr').allInnerTexts()).map(clean));
    const next = page.getByRole('button', { name: /next page/i }).first();
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click(); await page.waitForTimeout(2500);
  }
  return rows.filter(r => /QA Auto Agent/.test(r) && !/Blocked/.test(r)).map(r => ({ id: Number(r.match(/AG-0*(\d+)/)?.[1]), name: r.slice(0, 60) })).filter(a => a.id);
}

const todo = await openAgents();
console.log('to block:', JSON.stringify(todo.map(a => a.id)));
for (const a of todo) {
  await page.goto(`/agents/${a.id}/edit`);
  const blocked = page.getByRole('button', { name: 'Blocked', exact: true }).filter({ visible: true }).first();
  await blocked.waitFor({ timeout: 90000 });
  const isQa = await page.locator('input:visible').evaluateAll(es => es.some(e => /QA Auto Agent/.test(e.value)));
  if (!isQa) { console.log(`${a.id}: not a QA agent page - skipped`); continue; }
  await blocked.click();
  const before = log.length;
  await page.getByRole('button', { name: /^(Save|Save changes|Update agent|Save agent)$/i }).filter({ visible: true }).first().click();
  await page.waitForTimeout(4000);
  console.log(`${a.id} ${a.name} -> ${log.slice(before).join(' ').slice(0, 140)}`);
}
const left = await openAgents();
console.log('QA agents still not Blocked:', JSON.stringify(left.map(a => a.id)));
await browser.close();
