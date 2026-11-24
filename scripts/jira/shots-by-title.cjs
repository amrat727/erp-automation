// Lists the screenshot of every test in full-run/<dir>/*.json, keyed by test-id prefix (e.g. "TC-AR-01").
//   node scripts/jira/shots-by-title.cjs sahil3 "TC-AR-01|BUG-01 "
const fs = require('fs'), path = require('path');
const dir = path.join('full-run', process.argv[2] || 'sahil3');
const want = new RegExp(process.argv[3] || '.');
const out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  let r; try { r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
  const walk = s => { (s.suites || []).forEach(walk); (s.specs || []).forEach(sp => sp.tests.forEach(t => {
    if (!want.test(sp.title)) return;
    const res = t.results.at(-1) || {};
    const shots = (res.attachments || []).filter(a => /\.png$/.test(a.path || '')).map(a => a.path);
    const key = sp.title.split(':')[0];
    const mtime = fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).mtimeMs : 0;
    if (!out[key] || mtime > out[key].mtime) out[key] = { file: f, status: `${t.expectedStatus}->${res.status}`, shots, mtime };
  })); };
  (r.suites || []).forEach(walk);
}
for (const [k, v] of Object.entries(out)) console.log(`${k} | ${v.file} | ${v.status} | ${v.shots.map(s => path.relative(process.cwd(), s)).join(' ; ')}`);
