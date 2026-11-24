// Applies a revalidation result to Jira KAN: per bug a comment + screenshots, then the status
// (fixed -> Complete, still broken -> Reopened + label "reopened"); "new" entries are created as Bugs.
// Plan: a JSON file [{ key?, result: 'fixed'|'reopen'|'comment'|'new', comment, shots: [paths], summary?, description?, epic?, labels?, priority? }]
// Credentials: JIRA_EMAIL / JIRA_API_TOKEN in .env.
//   node scripts/jira/revalidate.mjs reports/Jira/revalidation-22nov.json [--dry-run]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const PLAN = process.argv[2];
const DRY = process.argv.includes('--dry-run');
const cfg = JSON.parse(fs.readFileSync('reports/Jira/jira-structure.json', 'utf8'));
const BASE = cfg.site.replace(/\/$/, ''), KEY = cfg.project.key;
const ASSIGNEE = '712020:70aa416e-9239-4f68-b1b5-6bfbc12897cc';   // Sahil Chauhan
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
const para = t => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
const doc = text => ({ type: 'doc', version: 1, content: text.split('\n').filter(l => l.trim()).map(para) });

async function attach(key, files) {
  const done = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.log(`    ! missing screenshot ${f}`); continue; }
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
    const r = await api('POST', `/rest/api/3/issue/${key}/attachments`, form, { 'X-Atlassian-Token': 'no-check' });
    if (r.ok) done.push(path.basename(f)); else console.log(`    ! attach ${path.basename(f)}: ${r.status}`);
  }
  return done;
}
async function moveTo(key, status) {
  const cur = await api('GET', `/rest/api/3/issue/${key}?fields=status`);
  if (cur.data?.fields?.status?.name === status) return status;
  const t = await api('GET', `/rest/api/3/issue/${key}/transitions`);
  const tr = (t.data?.transitions ?? []).find(x => x.to?.name === status || x.name === status);
  if (!tr) return `no transition to ${status} (has: ${(t.data?.transitions ?? []).map(x => x.to?.name).join(', ')})`;
  const r = await api('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: tr.id } });
  return r.ok ? status : `transition failed ${r.status}`;
}
async function labels(key, add) {
  const cur = await api('GET', `/rest/api/3/issue/${key}?fields=labels`);
  const l = [...new Set([...(cur.data?.fields?.labels ?? []), ...add])];
  await api('PUT', `/rest/api/3/issue/${key}`, { fields: { labels: l } });
}

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
for (const it of plan) {
  if (DRY) { console.log(`${it.key ?? 'NEW'} ${it.result} | shots: ${it.shots.map(s => (fs.existsSync(s) ? '' : 'MISSING ') + path.basename(s)).join(', ')}`); continue; }
  let key = it.key;
  if (it.result === 'new') {
    const r = await api('POST', '/rest/api/3/issue', { fields: {
      project: { key: KEY }, issuetype: { name: it.type || 'Bug' }, summary: it.summary, description: doc(it.description),
      parent: { key: it.epic }, labels: it.labels ?? [], priority: { name: it.priority ?? 'Medium' }, assignee: { accountId: ASSIGNEE } } });
    if (!r.ok) { console.log(`NEW failed ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); continue; }
    key = r.data.key;
    const files = await attach(key, it.shots);
    const st = await moveTo(key, 'To Do');
    console.log(`${key} NEW "${it.summary.slice(0, 60)}" | ${files.length} shot(s) | ${st}`);
    continue;
  }
  const files = await attach(key, it.shots);
  const body = `${it.comment}${files.length ? `\nScreenshot: ${files.join(', ')}` : ''}`;
  const c = await api('POST', `/rest/api/3/issue/${key}/comment`, { body: doc(body) });
  let st = '-';
  if (it.result === 'fixed') st = await moveTo(key, 'Complete');
  if (it.result === 'reopen') {
    st = await moveTo(key, 'Reopened'); await labels(key, ['reopened']);
    // user rule (24 Nov 2026): a reopened bug goes back to Sahil
    const a = await api('PUT', `/rest/api/3/issue/${key}/assignee`, { accountId: ASSIGNEE });
    st += a.ok ? ' + assigned to Sahil' : ` (assign failed ${a.status})`;
  }
  if (it.result === 'keep') {   // still broken where the workflow has no "Reopened" (e.g. PB2B): comment + back to Sahil
    const a = await api('PUT', `/rest/api/3/issue/${key}/assignee`, { accountId: ASSIGNEE });
    st = a.ok ? 'assigned to Sahil' : `assign failed ${a.status}`;
  }
  if (it.result === 'done') st = await moveTo(key, 'Done');
  console.log(`${key} ${it.result} | comment ${c.ok ? 'ok' : c.status} | ${files.length} shot(s) | ${st}`);
}
