/*
 * The review list for the ERP UI/UX consistency check: every difference with its screen, what is shown, the standard and
 * the Jira issue - plus a sheet per bug and the full check.
 *   node scripts/reports/ui-consistency-list.cjs  ->  reports/UI-Consistency/ERP-UI-Consistency-Review.xlsx
 */
const fs = require('fs');
const ExcelJS = require('exceljs');
const rows = JSON.parse(fs.readFileSync('reports/UI-Consistency/rows.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync('reports/Jira/ui-consistency-bugs.json', 'utf8'));
const KEYS = ['KAN-176', 'KAN-177', 'KAN-178', 'KAN-179', 'KAN-180', 'KAN-181', 'KAN-182', 'KAN-183', 'KAN-184', 'KAN-185', 'KAN-186', 'KAN-187', 'KAN-188', 'KAN-189', 'KAN-190'];
// which Jira issue holds each (screen, rule): read the screen list written in each bug's description
const where = {};
plan.forEach((b, i) => { for (const line of b.description.split('\n').filter(l => l.startsWith('- /'))) { const screen = line.slice(2).split(':')[0]; where[`${screen}|${i}`] = KEYS[i]; } });
const ruleOf = r => plan.findIndex(b => b.description.split('\n').some(l => l.startsWith(`- ${r.screen}:`) && l.includes(r.rule.replace(/^S\d+\w? /, ''))));
const ALREADY = { '/agentinvoices|S11': 'KAN-160', '/supplierinvoices|S11': 'KAN-160', '/portal-cms/deals|S11': 'KAN-159', '/portal-cms/offers|S11': 'KAN-159', '/portal-cms/storefront|S11': 'KAN-159', '/enquiries': 'KAN-101', '/packages|S10': 'KAN-100', '/agents|S8a': 'KAN-113', '/journals|S10': 'KAN-137', '/recurringjournals|S10': 'KAN-137', '/portal-cms/documents|S10': 'KAN-112' };
const BY_DESIGN = { '/companies|S2a': 'one company per login - no Add expected?', '/feedback|S2a': 'feedback comes from travellers - no Add expected?', '/system/data-retention|S2a': 'settings screen - no Add expected?', '/financialperiods|S2a': '"Create 2026" creates the year at once', '/agentinvoices|S2a': 'uses "Raise invoice" instead of Add', '/supplierinvoices|S2a': 'uses "Enter supplier invoice" instead of Add', '/dashboard|S10': 'Dashboard shortcut "New Reservation" (KAN-156)' };
const jiraFor = r => {
  const i = ruleOf(r); if (i >= 0) return KEYS[i];
  const code = r.rule.split(' ')[0].replace(/[a-z]$/, '');
  return ALREADY[`${r.screen}|${code}`] || ALREADY[`${r.screen}|${r.rule.split(' ')[0]}`] || ALREADY[r.screen] || (r.screen === '/packages' && /S8b/.test(r.rule) ? 'KAN-189' : '');
};
(async () => {
  const wb = new ExcelJS.Workbook(); wb.creator = 'QA Automation (Playwright)';
  const head = (ws, cols) => { ws.columns = cols; ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.alignment = { vertical: 'middle', wrapText: true }; }); };
  // 1. bugs
  const b = wb.addWorksheet('Bugs raised', { views: [{ state: 'frozen', ySplit: 1 }] });
  head(b, [{ header: 'Jira', width: 11 }, { header: 'Priority', width: 9 }, { header: 'Bug', width: 90 }, { header: 'Screens', width: 9 }, { header: 'Your check', width: 22 }]);
  plan.forEach((p, i) => { const r = b.addRow([{ text: KEYS[i], hyperlink: `https://piloterp.atlassian.net/browse/${KEYS[i]}` }, p.priority, p.summary.replace(/^BUG-\d+: /, ''), p.description.split('\n').filter(l => l.startsWith('- /')).length, '']); r.alignment = { vertical: 'top', wrapText: true }; r.getCell(1).font = { color: { argb: 'FF0563C1' }, underline: true }; r.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; });
  // 2. every difference
  const d = wb.addWorksheet('Every difference', { views: [{ state: 'frozen', ySplit: 1 }] });
  head(d, [{ header: '#', width: 5 }, { header: 'Screen', width: 26 }, { header: 'Rule', width: 46 }, { header: 'Shown', width: 55 }, { header: 'Standard', width: 42 }, { header: 'Jira', width: 11 }, { header: 'Note', width: 40 }, { header: 'Your check', width: 22 }]);
  const diffs = rows.filter(r => r.result === 'DIFFERENT').sort((x, y) => x.rule.localeCompare(y.rule) || x.screen.localeCompare(y.screen));
  diffs.forEach((r, i) => {
    const j = jiraFor(r), code = r.rule.split(' ')[0];
    const note = BY_DESIGN[`${r.screen}|${code}`] || BY_DESIGN[`${r.screen}|${code.replace(/[a-z]$/, '')}`] || r.note;
    const row = d.addRow([i + 1, r.screen, r.rule, r.shown, r.expected, j ? { text: j, hyperlink: `https://piloterp.atlassian.net/browse/${j}` } : '-', note, '']);
    row.alignment = { vertical: 'top', wrapText: true }; if (j) row.getCell(6).font = { color: { argb: 'FF0563C1' }, underline: true };
    row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  });
  d.autoFilter = { from: 'A1', to: `H${diffs.length + 1}` };
  // 3. full check
  const a = wb.addWorksheet('All checks', { views: [{ state: 'frozen', ySplit: 1 }] });
  head(a, [{ header: 'Screen', width: 26 }, { header: 'Rule', width: 46 }, { header: 'Result', width: 12 }, { header: 'Shown', width: 55 }, { header: 'Standard', width: 42 }, { header: 'Note', width: 40 }]);
  rows.forEach(r => { const row = a.addRow([r.screen, r.rule, r.result, r.shown, r.expected, r.note]); row.alignment = { vertical: 'top', wrapText: true }; row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.result === 'OK' ? 'FFC6EFCE' : r.result === 'DIFFERENT' ? 'FFFFC7CE' : 'FFEDEDED' } }; });
  a.autoFilter = { from: 'A1', to: `F${rows.length + 1}` };
  await wb.xlsx.writeFile('reports/UI-Consistency/ERP-UI-Consistency-Review.xlsx');
  const noJira = diffs.filter(r => !jiraFor(r)).length;
  console.log(`written: ${plan.length} bugs, ${diffs.length} differences (${noJira} without a Jira key = by design / for your review), ${rows.length} checks`);
})();
