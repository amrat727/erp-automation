/*
 * ERP UI/UX consistency - compares every screen read by scripts/probes/ui-consistency-crawl.mjs with the Core standard
 * (a Core list screen such as States). One row per screen x rule.
 *   node scripts/reports/ui-consistency-check.cjs  ->  reports/UI-Consistency/ERP-UI-Consistency.xlsx (+ console summary)
 * Known by design (product owner): Airport has no Add / Edit (KAN-21).
 */
const fs = require('fs'), path = require('path');
const ExcelJS = require('exceljs');
const F = {};
for (const f of fs.readdirSync('reports/ui-consistency').filter(f => /^facts-.*\.json$/.test(f))) Object.assign(F, JSON.parse(fs.readFileSync(path.join('reports/ui-consistency', f), 'utf8')));

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'per']);
const titleCase = t => t.split(/\s+/).filter(Boolean).every((w, i) => !/^[a-z]/.test(w) || (i > 0 && SMALL.has(w)));
const singular = s => s.replace(/ies$/, 'y').replace(/(ch|sh|x|ss)es$/, '$1').replace(/s$/, '');
const BY_DESIGN = { '/airports': ['S2', 'S7', 'S10'] };
// size standard measured on Core > Region > State (list) and Add State (form), 24 Nov 2026
const S0 = F['/states'] || {};
const STD = { row: S0.listSizes?.rowHeight ?? 43, header: S0.listSizes?.headerHeight ?? 46, cellFont: S0.listSizes?.cellFont ?? '14px', headerFont: S0.listSizes?.headerFont ?? '14px', addBtn: S0.listSizes?.addButtonHeight ?? 37, auditBtn: S0.listSizes?.auditButtonHeight ?? 31,
  input: S0.addForm?.sizes?.inputHeights?.[0] ?? 40, label: S0.addForm?.sizes?.labelFont ?? '13px', formButtons: S0.addForm?.sizes?.buttonHeights ?? [37, 31], dialogWidth: S0.addForm?.sizes?.width ?? 600 };
const rows = [];
const add = (screen, rule, ok, shown, expected, note = '') => rows.push({ screen, rule, result: ok === null ? 'n/a' : ok ? 'OK' : 'DIFFERENT', shown: String(shown ?? ''), expected: String(expected ?? ''), note });

for (const [p, f] of Object.entries(F)) {
  if (f.error) { add(p, 'S0 Screen opens', false, f.error, 'opens'); continue; }
  const title = typeof f.title === 'string' ? f.title.replace(/ · .*$/, '').replace(/\s*\d+$/, '') : '';
  const entity = singular(title);
  const design = BY_DESIGN[p] || [];
  const tb = Array.isArray(f.toolbarButtons) ? f.toolbarButtons : [];
  add(p, 'S1 Title in Title Case', p === '/dashboard' ? null : title ? titleCase(title) : null, title, 'Title Case', p === '/dashboard' ? 'greeting, not a title' : '');
  // S11: every visible button in Title Case
  const ACTION = /^(Add|New|Create|Raise|Enter|Edit|Save|Delete|Download|Upload|Import|Export|Post|Close|Reset|Publish|Unpublish|Send|Clear|Insert|Start|Build|Approve|Reject|Generate|Apply|Copy|Roll|Request|Record|Grant|Revalue|Select|Run|Retry|Discard|Back|Next)\b/;
  const bad = tb.filter(b => ACTION.test(b) && !/[\u00b7\d]/.test(b) && !titleCase(b));
  add(p, 'S11 Buttons in Title Case', bad.length === 0, bad.join(' | ') || 'all Title Case', 'Title Case ("Add State", "Audit History")');
  if (f.kind !== 'list') {
    const a = f.addForm || {};
    if (a.button) {
      add(p, 'S10a Add button says "Add <Screen>"', /^Add /.test(a.button), a.button, `Add ${entity}`);
      add(p, 'S10b Add opens a dialog titled "Add ..."', a.opens === 'dialog' && /^Add /.test(a.title || ''), `${a.opens}: ${a.title}`, `dialog "Add ${entity}"`);
      add(p, 'S10c Empty Save: "<Field> is required" under the fields, no banner', (a.messages || []).length > 0 && (a.messages || []).every(m => / is required$/.test(m)) && !(a.banner || []).length, `${(a.messages || []).join('; ') || '(none)'}${(a.banner || []).length ? ' | banner: ' + a.banner.join('; ') : ''}${a.saveEnabledWhenEmpty === false ? ' | Save disabled' : ''}`, '"<Field> is required" under every required field');
      add(p, 'S10d Nothing is sent on an empty Save', a.sentToServer === 0, `${a.sentToServer} request(s)`, '0');
    const z = a.sizes || {};
    // sizes are only reliable on DIALOG forms (a full-page form also contains the list page's own controls);
    // a multi-line text area (60 px) is meant to be taller
    if (a.opens === 'dialog' && z.inputHeights && z.inputCount) {
      z.inputHeights = z.inputHeights.filter(h => h < 55);
      add(p, 'S12 Form input / dropdown height 40 px', z.inputHeights.every(h => h === STD.input), `${z.inputHeights.join(' / ')} px (${z.inputCount} fields)`, `${STD.input} px`);
      add(p, 'S13 Form label size 13 px', z.labelFont === STD.label, z.labelFont, STD.label);
      add(p, 'S14 Form button heights like Add State', JSON.stringify([...(z.buttonHeights || [])].sort()) === JSON.stringify([...STD.formButtons].sort()), `${(z.buttonHeights || []).join(' / ')} px`, `${STD.formButtons.join(' / ')} px`);
      if (a.opens === 'dialog') add(p, 'S15 Add dialog width 600 px', z.width === STD.dialogWidth, `${z.width} px`, `${STD.dialogWidth} px`, z.width > STD.dialogWidth ? 'wider - check if the form needs it' : '');
    }
    }
    continue;
  }
  // ---------- list screens ----------
  const addBtn = tb.find(b => /^(\+\s*)?(Add|New|Create)\b/i.test(b));
  add(p, 'S2a Toolbar "Add <Screen>"', design.includes('S2') ? null : addBtn ? addBtn === `Add ${entity}` || /^Add [A-Z]/.test(addBtn) : false, addBtn || '(no Add button)', `Add ${entity}`, design.includes('S2') ? 'no Add by design' : '');
  add(p, 'S2b Toolbar "Audit History"', tb.includes('Audit History'), tb.includes('Audit History') ? 'Audit History' : '(missing)', 'Audit History');
  add(p, 'S2c Toolbar "Columns"', tb.includes('Columns'), tb.includes('Columns') ? 'Columns' : '(missing)', 'Columns');
  const sr = f.search || {};
  add(p, 'S3 Column search ("Search <column>")', sr.found === true && /^Search \w/.test(sr.placeholder || ''), sr.found ? `${sr.how}, "${sr.placeholder}"` : '(no column search)', 'opens on click, "Search <column>"');
  add(p, 'S4a Empty search message', sr.found ? /^There are no records in /.test(sr.emptyMessage || '') : null, sr.emptyMessage || '(none)', `There are no records in ${entity}`);
  add(p, 'S4b Empty search shows "0–0 of 0"', sr.found ? sr.range === '0–0 of 0' : null, sr.range || '(none)', '0–0 of 0');
  const pg = f.paging || {};
  const total = +((pg.range || '').split(' of ')[1] || 0);
  add(p, 'S5 Paging (1–N of N, Page X of Y; Rows per page when more than 10 rows)', !!(pg.range && pg.pageOf && (pg.rowsPerPage || total <= 10)), `${pg.rowsPerPage ? 'Rows per page' : '-'} | ${pg.range || '-'} | ${pg.pageOf || '-'}`, 'Rows per page | 1–N of N | Page X of Y');
  const act = (f.filters || []).find(x => (x.options || []).includes('Active'));
  add(p, 'S6 Active filter "All / Active / Inactive"', act ? act.options.join(' / ') === 'All / Active / Inactive' : false, act ? act.options.join(' / ') : '(no Active filter)', 'All / Active / Inactive');
  const rc = f.rowClick;
  add(p, 'S7 Clicking a row opens the record', design.includes('S7') ? null : rc === 'no rows' ? null : rc?.opens ? rc.opens !== 'nothing' : null, rc?.opens ? `${rc.opens}${rc.title ? ': ' + rc.title.slice(0, 30) : rc.url ? ': ' + rc.url : ''}` : rc, 'opens Edit dialog / record page', design.includes('S7') ? 'read-only by design' : '');
  const rcl = f.rowControls || {};
  add(p, 'S8a Active switch on each row', rc === 'no rows' ? null : !!rcl.switch, rcl.switch ? 'switch' : '(no switch)', 'Active switch');
  const dp = f.deactivatePopup || {};
  if (dp.tested && dp.popup) {
    // product owner 24 Nov 2026: Title Case for every dialog / popup title -> "Deactivate State?"
    const pt = dp.text.match(/Deactivate[^?]*\?/)?.[0] || '';
    add(p, 'S8b Deactivate popup title in Title Case "Deactivate <Item>?"', !!pt && titleCase(pt.replace(/\?$/, '')), pt || dp.text.slice(0, 40), `Deactivate ${entity}?`);
    add(p, 'S8c Popup text "This will mark the <screen> as inactive."', /This will mark the [\w -]+ as inactive\./.test(dp.text) && !/deactive\b/.test(dp.text), dp.text.replace(/^.*?\?\s*/, '').slice(0, 90), `This will mark the ${entity.toLowerCase()} as inactive.`);
    add(p, 'S8d Popup buttons "Yes, Deactivate" + "Cancel"', JSON.stringify((dp.buttons || []).filter(b => b !== '×')) === JSON.stringify(['Yes, Deactivate', 'Cancel']), (dp.buttons || []).join(' / '), 'Yes, Deactivate / Cancel');
  } else if (dp.tested && dp.popup === false) add(p, 'S8b Deactivate asks for confirmation', p === '/users' ? null : false, 'no popup', 'popup "Deactivate ...?"', p === '/users' ? 'the switch tested is your own account - locked on purpose (KAN-140)' : '');
  else add(p, 'S8b Deactivate popup', null, dp.reason || dp.error || 'not tested', '', 'no active record on page 1 to test safely');
  const au = f.audit || {};
  add(p, 'S9 Audit History tabs All / Created / Updated / Inactive', au.button ? JSON.stringify(au.tabs) === JSON.stringify(['All', 'Created', 'Updated', 'Inactive']) : null, au.button ? (au.tabs || []).join(' / ') : '(no button)', 'All / Created / Updated / Inactive');
  const ls = f.listSizes || {};
  if (ls.rowHeight) {
    add(p, 'S16a List row height 43 px', ls.rowHeight === STD.row, `${ls.rowHeight} px`, `${STD.row} px`);
    add(p, 'S16b List header height 46 px', ls.headerHeight === STD.header, `${ls.headerHeight} px`, `${STD.header} px`);
    add(p, 'S16c List text size 14 px', ls.cellFont === STD.cellFont && ls.headerFont === STD.headerFont, `cells ${ls.cellFont}, header ${ls.headerFont}`, `${STD.cellFont} / ${STD.headerFont}`);
  }
  if (ls.addButtonHeight) add(p, 'S17a Toolbar Add button height 37 px', ls.addButtonHeight === STD.addBtn, `${ls.addButtonHeight} px`, `${STD.addBtn} px`);
  if (ls.auditButtonHeight) add(p, 'S17b Audit History button height 31 px', ls.auditButtonHeight === STD.auditBtn, `${ls.auditButtonHeight} px`, `${STD.auditBtn} px`);
  const a = f.addForm || {};
  // an Add-type button that opens no form (e.g. Financial Periods "Create 2026" creates the year at once) is an action, not a form
  if (a.button && a.opens === 'same page' && (a.title || "").startsWith("(no form title")) add(p, 'S10 Add opens a form', null, `${a.button}: no form - direct action`, '', 'action button, form rules not applied');
  else if (a.button && !design.includes('S10')) {
    add(p, 'S10a Add opens "Add <Screen>"', /^Add /.test(a.title || ''), `${a.opens}: ${a.title}`, `"Add ${entity}"`);
    add(p, 'S10b Form buttons "Cancel" + "Save"', (a.buttons || []).includes('Cancel') && (a.buttons || []).some(b => /^Save$/.test(b)), (a.buttons || []).filter(b => /Cancel|Save|Create|Add|Submit|Close|Post|Raise/i.test(b)).join(' / '), 'Cancel / Save');
    const req = (a.labels || []).filter(l => /\*$/.test(l)).length;
    add(p, 'S10c Required fields marked *', req > 0, `${req} field(s) with *`, 'every required field ends with *');
    const msgs = a.messages || [];
    add(p, 'S10d Empty Save: "<Field> is required" under the fields, no banner', msgs.length > 0 && msgs.every(m => / is required$/.test(m)) && !(a.banner || []).length && a.saveEnabledWhenEmpty !== false, `${msgs.join('; ') || '(none)'}${(a.banner || []).length ? ' | banner: ' + a.banner.join('; ') : ''}${a.saveEnabledWhenEmpty === false ? ' | Save disabled' : ''}`, '"<Field> is required" under every required field');
    add(p, 'S10e Every required (*) field gets its message', msgs.length >= req, `${msgs.length} message(s) for ${req} required field(s)`, 'one message per required field');
    add(p, 'S10f Nothing is sent on an empty Save', a.sentToServer === 0, `${a.sentToServer} request(s)`, '0');
    const z = a.sizes || {};
    // sizes are only reliable on DIALOG forms (a full-page form also contains the list page's own controls);
    // a multi-line text area (60 px) is meant to be taller
    if (a.opens === 'dialog' && z.inputHeights && z.inputCount) {
      z.inputHeights = z.inputHeights.filter(h => h < 55);
      add(p, 'S12 Form input / dropdown height 40 px', z.inputHeights.every(h => h === STD.input), `${z.inputHeights.join(' / ')} px (${z.inputCount} fields)`, `${STD.input} px`);
      add(p, 'S13 Form label size 13 px', z.labelFont === STD.label, z.labelFont, STD.label);
      add(p, 'S14 Form button heights like Add State', JSON.stringify([...(z.buttonHeights || [])].sort()) === JSON.stringify([...STD.formButtons].sort()), `${(z.buttonHeights || []).join(' / ')} px`, `${STD.formButtons.join(' / ')} px`);
      if (a.opens === 'dialog') add(p, 'S15 Add dialog width 600 px', z.width === STD.dialogWidth, `${z.width} px`, `${STD.dialogWidth} px`, z.width > STD.dialogWidth ? 'wider - check if the form needs it' : '');
    }
  }
}

fs.mkdirSync('reports/UI-Consistency', { recursive: true }); fs.writeFileSync('reports/UI-Consistency/rows.json', JSON.stringify(rows, null, 1));
const diff = rows.filter(r => r.result === 'DIFFERENT');
console.log(`screens: ${Object.keys(F).length} | checks: ${rows.length} | OK ${rows.filter(r => r.result === 'OK').length} | DIFFERENT ${diff.length} | n/a ${rows.filter(r => r.result === 'n/a').length}`);
const byRule = {}; diff.forEach(r => (byRule[r.rule] = byRule[r.rule] || []).push(`${r.screen} [${r.shown.slice(0, 50)}]`));
for (const [k, v] of Object.entries(byRule).sort()) console.log(`\n${k} - ${v.length} screen(s):\n  ${v.join('\n  ')}`);
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('All checks', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ header: '#', width: 5 }, { header: 'Screen', width: 26 }, { header: 'Rule', width: 48 }, { header: 'Result', width: 12 }, { header: 'Shown', width: 60 }, { header: 'Standard', width: 44 }, { header: 'Note / Jira', width: 40 }, { header: 'Your check', width: 18 }];
  ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; });
  rows.sort((x, y) => (x.result === 'DIFFERENT' ? 0 : 1) - (y.result === 'DIFFERENT' ? 0 : 1) || x.rule.localeCompare(y.rule) || x.screen.localeCompare(y.screen));
  rows.forEach((r, i) => { const row = ws.addRow([i + 1, r.screen, r.rule, r.result, r.shown, r.expected, r.note, '']); row.alignment = { vertical: 'top', wrapText: true }; row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.result === 'OK' ? 'FFC6EFCE' : r.result === 'DIFFERENT' ? 'FFFFC7CE' : 'FFEDEDED' } }; row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; });
  ws.autoFilter = { from: 'A1', to: `H${rows.length + 1}` };
  fs.mkdirSync('reports/UI-Consistency', { recursive: true });
  await wb.xlsx.writeFile('reports/UI-Consistency/ERP-UI-Consistency.xlsx');
  console.log('\nwritten reports/UI-Consistency/ERP-UI-Consistency.xlsx');
})();
