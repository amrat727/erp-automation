// Prints every question + the product owner's answer from a question workbook (no images).
//   node scripts/read-answers.js reports/Round3-Questions/Open-Questions.xlsx
const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const text = v => String(v == null ? '' : typeof v === 'object' ? (v.richText ? v.richText.map(r => r.text).join('') : v.text ?? v.result ?? JSON.stringify(v)) : v);
  for (const ws of wb.worksheets) {
    const head = [];
    ws.getRow(1).eachCell((c, i) => { head[i] = text(c.value).trim(); });
    // header row may not be row 1: find the row that has "Answer"
    let hr = 1;
    for (let r = 1; r <= Math.min(ws.rowCount, 8); r++) { const vals = []; ws.getRow(r).eachCell((c, i) => { vals[i] = text(c.value).trim(); }); if (vals.some(v => /answer/i.test(v ?? '')) && vals.some(v => /question/i.test(v ?? ''))) { hr = r; vals.forEach((v, i) => head[i] = v); break; } }
    const col = re => head.findIndex(h => h && re.test(h));
    const id = col(/^(#|ID|No)/i), q = col(/question/i), a = col(/your answer/i) > 0 ? col(/your answer/i) : col(/answer/i);
    console.log(`\n##### ${ws.name}  (header row ${hr}; id=${head[id]} q=${head[q]} a=${head[a]})`);
    if (a < 0) continue;
    for (let r = hr + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const qid = text(row.getCell(id > 0 ? id : 1).value).trim();
      const qt = text(row.getCell(q).value).trim();
      const at = text(row.getCell(a).value).trim();
      if (!qid && !qt) continue;
      console.log(`[${qid}] Q: ${qt.replace(/\s+/g, ' ').slice(0, 260)}\n      A: ${at ? at.replace(/\s+/g, ' ') : '(no answer)'}`);
    }
  }
})();
