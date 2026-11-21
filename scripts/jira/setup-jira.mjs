// Jira setup for project KAN (Pilot-ERP) through the Jira Cloud REST API - things the Atlassian connector cannot do.
//   1. creates the sub-module COMPONENTS listed in reports/Jira/jira-structure.json (skips ones that already exist)
//   2. checks whether the work type "Bug" exists in KAN and, if not, TRIES to create it
//   3. reports the statuses (the "Reopened" status of a team-managed project can only be added in the Jira screen)
// Credentials: JIRA_EMAIL and JIRA_API_TOKEN in .env (the user creates the token at id.atlassian.com -> Security -> API tokens).
// Nothing is printed about the token.            Run:  node scripts/jira/setup-jira.mjs [--dry-run]
import 'dotenv/config';
import fs from 'fs';

const { JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
const DRY = process.argv.includes('--dry-run');
const cfg = JSON.parse(fs.readFileSync('reports/Jira/jira-structure.json', 'utf8'));
const BASE = cfg.site.replace(/\/$/, '');
const KEY = cfg.project.key;
if (!JIRA_EMAIL || !JIRA_API_TOKEN) { console.error('Missing JIRA_EMAIL / JIRA_API_TOKEN in .env'); process.exit(1); }
const auth = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

async function api(method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// --- who am I / project
const me = await api('GET', '/rest/api/3/myself');
if (!me.ok) { console.error(`Login failed (${me.status}) - check JIRA_EMAIL / JIRA_API_TOKEN`); process.exit(1); }
const project = await api('GET', `/rest/api/3/project/${KEY}`);
if (!project.ok) { console.error(`Project ${KEY} not readable (${project.status})`); process.exit(1); }
console.log(`Signed in as ${me.data.displayName}; project ${KEY} "${project.data.name}" (${project.data.style})${DRY ? ' - DRY RUN, nothing is changed' : ''}`);

// --- 1. components
const wanted = Object.values(cfg.epics).flatMap(e => e.components);
const existing = await api('GET', `/rest/api/3/project/${KEY}/components`);
const have = new Set((existing.data ?? []).map(c => c.name));
let made = 0;
for (const name of wanted) {
  if (have.has(name)) { console.log(`  = ${name} (exists)`); continue; }
  if (DRY) { console.log(`  + ${name} (would create)`); continue; }
  const r = await api('POST', '/rest/api/3/component', { project: KEY, name });
  if (r.ok) { made++; console.log(`  + ${name}`); }
  else console.log(`  ! ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
}
console.log(`Components: ${made} created, ${have.size} already there, ${wanted.length} wanted`);

// --- 2. Bug work type
const types = project.data.issueTypes ?? [];
if (types.some(t => t.name === 'Bug')) console.log('Work type Bug: exists');
else if (DRY) console.log('Work type Bug: missing (would try to create)');
else {
  // team-managed projects keep project-scoped work types; this endpoint creates a site-level type, which may not be
  // added to a team-managed project automatically - then it has to be added in Space settings -> Work types
  const r = await api('POST', '/rest/api/3/issuetype', { name: 'Bug', description: 'A problem found in the ERP (automation / manual testing).', type: 'standard', hierarchyLevel: 0 });
  const again = await api('GET', `/rest/api/3/project/${KEY}`);
  const inProject = (again.data?.issueTypes ?? []).some(t => t.name === 'Bug');
  console.log(`Work type Bug: create answered ${r.status}${r.ok ? '' : ' ' + JSON.stringify(r.data).slice(0, 200)}; in project ${KEY} now: ${inProject ? 'YES' : 'NO - add it in Space settings -> Work types'}`);
}

// --- 3. statuses
const st = await api('GET', `/rest/api/3/project/${KEY}/statuses`);
const names = [...new Set((st.data ?? []).flatMap(t => t.statuses.map(s => s.name)))];
console.log(`Statuses: ${names.join(', ')}${names.includes('Reopened') ? '' : '  (Reopened missing - add it in the Bug workflow screen)'}`);
