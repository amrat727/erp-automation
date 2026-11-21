// Creates the bugs of reports/Jira/bugs-to-migrate.json in Jira project KAN (type Bug) through the Jira Cloud REST API:
//   parent = module epic, labels (sub-module + kind), priority, assignee Sahil, screenshots as attachments,
//   status (To Do / Reopened / Complete - Complete gets a "verified fixed" comment + fix screenshot).
// Safe to re-run: bugs already in reports/Jira/jira-map.json or already in KAN (summary starts with "BUG-nn:") are skipped.
// Credentials: JIRA_EMAIL / JIRA_API_TOKEN in .env.
//   node scripts/jira/migrate-bugs.mjs [--only=BUG-01,BUG-02] [--limit=N] [--dry-run]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const arg = n => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=')[1];
const DRY = process.argv.includes('--dry-run');
const ONLY = arg('only')?.split(',');
const LIMIT = Number(arg('limit') ?? Infinity);
const cfg = JSON.parse(fs.readFileSync('reports/Jira/jira-structure.json', 'utf8'));
const BASE = cfg.site.replace(/\/$/, ''), KEY = cfg.project.key;
const ASSIGNEE = '712020:70aa416e-9239-4f68-b1b5-6bfbc12897cc';   // Sahil Chauhan (project lead)
const MAP = 'reports/Jira/jira-map.json';
const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const save = () => fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(method, p, body, extra = {}) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(BASE + p, { method, headers: { Authorization: auth, Accept: 'application/json', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
    const t = await res.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
    return { ok: res.ok, status: res.status, data: d };
  }
  return { ok: false, status: 429, data: 'rate limited' };
}

// ---- markdown (the small subset our descriptions use) -> Atlassian Document Format
function inline(text) {
  const out = []; const re = /\*\*(.+?)\*\*|`(.+?)`/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    out.push(m[1] ? { type: 'text', text: m[1], marks: [{ type: 'strong' }] } : { type: 'text', text: m[2], marks: [{ type: 'code' }] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out.length ? out : [{ type: 'text', text: ' ' }];
}
function adf(md) {
  const content = []; let list = null;
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (bullet) { (list ??= { type: line.trim().match(/^\d+\./) ? 'orderedList' : 'bulletList', content: [] }).content.push({ type: 'listItem', content: [{ type: 'paragraph', content: inline(bullet[1]) }] }); continue; }
    if (list) { content.push(list); list = null; }
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    content.push(h ? { type: 'heading', attrs: { level: h[1].length }, content: inline(h[2]) } : { type: 'paragraph', content: inline(line) });
  }
  if (list) content.push(list);
  return { type: 'doc', version: 1, content };
}

async function attach(key, files) {
  const done = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
    const r = await api('POST', `/rest/api/3/issue/${key}/attachments`, form, { 'X-Atlassian-Token': 'no-check' });
    if (r.ok) done.push(path.basename(f)); else console.log(`    ! attach ${path.basename(f)}: ${r.status}`);
  }
  return done;
}
async function moveTo(key, status) {
  // new work items start in "Idea" - every bug is moved to its real status (To Do / Reopened / Complete)
  const cur = await api('GET', `/rest/api/3/issue/${key}?fields=status`);
  if (cur.data?.fields?.status?.name === status) return true;
  const t = await api('GET', `/rest/api/3/issue/${key}/transitions`);
  const tr = (t.data?.transitions ?? []).find(x => x.to?.name === status || x.name === status);
  if (!tr) { console.log(`    ! no transition to ${status}: ${(t.data?.transitions ?? []).map(x => x.to?.name).join(', ')}`); return false; }
  const r = await api('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: tr.id } });
  return r.ok;
}

// ---- already in Jira?
const existing = {};
let next;
do {
  const r = await api('POST', '/rest/api/3/search/jql', { jql: `project = ${KEY} AND issuetype = Bug`, fields: ['summary'], maxResults: 100, ...(next ? { nextPageToken: next } : {}) });
  if (!r.ok) { console.error(`search failed ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); process.exit(1); }
  for (const i of r.data.issues ?? []) { const id = i.fields.summary.match(/^(BUG-\d+):/)?.[1]; if (id) existing[id] = i.key; }
  next = r.data.nextPageToken;
} while (next);

const bugs = JSON.parse(fs.readFileSync('reports/Jira/bugs-to-migrate.json', 'utf8')).filter(b => !ONLY || ONLY.includes(b.id));
let made = 0, skipped = 0, failed = 0;
for (const b of bugs) {
  if (map[b.id]?.key || existing[b.id]) {
    skipped++; map[b.id] ??= { key: existing[b.id] };
    if (!DRY && process.argv.includes('--fix-status')) { map[b.id].statusSet = await moveTo(map[b.id].key, b.status); map[b.id].status = b.status; save(); }
    continue;
  }
  if (made >= LIMIT) break;
  if (DRY) { console.log(`would create ${b.id} -> ${b.epicKey} [${b.labels.join(', ')}] ${b.priority} ${b.status} shots:${b.screenshots.length}+${b.fixScreenshots.length}`); made++; continue; }
  const r = await api('POST', '/rest/api/3/issue', { fields: {
    project: { key: KEY }, issuetype: { name: 'Bug' }, summary: b.summary, description: adf(b.description),
    parent: { key: b.epicKey }, priority: { name: b.priority }, labels: b.labels, assignee: { accountId: ASSIGNEE } } });
  if (!r.ok) { failed++; console.log(`  ! ${b.id}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); continue; }
  const key = r.data.key;
  const shots = await attach(key, b.screenshots);
  let fixShots = [];
  if (b.status === 'Complete') {
    fixShots = await attach(key, b.fixScreenshots);
    const note = b.duplicateOf ? `Closed as **duplicate of ${b.duplicateOf}** (same problem, tracked there).`
      : `✅ Verified fixed on the stage build of 21 Nov 2026 (automated re-test).${fixShots.length ? ` Fix screenshot attached: ${fixShots.join(', ')}.` : ''}`;
    await api('POST', `/rest/api/3/issue/${key}/comment`, { body: adf(note) });
  }
  const moved = await moveTo(key, b.status);
  map[b.id] = { key, url: `${BASE}/browse/${key}`, epic: b.epicKey, label: b.label, status: b.status, shots: shots.length, fixShots: fixShots.length, statusSet: moved };
  save(); made++;
  console.log(`  + ${b.id} -> ${key} (${b.epic} / ${b.label}, ${b.status}${moved ? '' : ' NOT SET'}, ${shots.length}+${fixShots.length} shots)`);
  await sleep(250);
}
save();
console.log(`created ${made}, skipped ${skipped} (already in Jira), failed ${failed}${DRY ? ' - DRY RUN' : ''}`);
