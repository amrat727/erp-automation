// Helper (not a test): READ-ONLY - reads the audit trail (GET /core/audit) of every reservation and supplier and keeps
// the timestamp of the "created" entry of the record itself -> reports/dashboard/data/created-dates.json
//   node scripts/probes/dashboard-created-dates.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const D = 'reports/dashboard/data';
const { browser, page } = await open({});
page.setDefaultTimeout(60000);
let api = '';
page.on('request', r => { const m = r.url().match(/^(https:\/\/[^/]*pilottest[^/]*)\//); if (m) api = m[1]; });
await page.goto('/dashboard'); await page.waitForTimeout(8000);
const get = async (p) => page.evaluate(async ([base, path]) => {
  const tok = (sessionStorage.getItem('token') || '').replace(/^"|"$/g, '');
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' } });
  return r.ok ? r.json() : null;
}, [api, p]);
const items = b => Array.isArray(b) ? b : (b?.items || b?.data || []);
const out = { reservations: {}, suppliers: {}, sample: null };
const firstCreate = (rows, entity, id) => {
  const own = rows.filter(r => String(r.entityName || r.entity || '').toLowerCase() === entity.toLowerCase() && String(r.entityId) === String(id) && /creat|add|insert/i.test(r.action || r.changeType || r.operation || ''));
  const all = own.length ? own : rows.filter(r => /creat|add|insert/i.test(r.action || r.changeType || r.operation || ''));
  const t = all.map(r => r.timestamp || r.createdAt || r.changedAt || r.date || r.occurredAt).filter(Boolean).sort();
  return t[0] || null;
};
for (const r of JSON.parse(fs.readFileSync(`${D}/reservations.json`, 'utf8'))) {
  const rows = items(await get(`/core/audit?page=1&pageSize=500&entityName=Reservation&entityId=${r.id}&includeChildren=true`));
  if (!out.sample && rows.length) out.sample = rows[rows.length - 1];
  out.reservations[r.ref] = { id: r.id, created: firstCreate(rows, 'Reservation', r.id), status: r.status, entries: rows.length };
}
for (const s of JSON.parse(fs.readFileSync(`${D}/suppliers.json`, 'utf8'))) {
  const rows = items(await get(`/core/audit?page=1&pageSize=500&entityName=Supplier&entityId=${s.id}&includeChildren=true`));
  out.suppliers[s.code] = { id: s.id, name: s.name, created: firstCreate(rows, 'Supplier', s.id), entries: rows.length };
}
fs.writeFileSync(`${D}/created-dates.json`, JSON.stringify(out, null, 1));
console.log('sample audit row keys:', Object.keys(out.sample || {}).join(','));
console.log('reservations:', Object.entries(out.reservations).map(([k, v]) => `${k}=${(v.created || '?').slice(0, 16)}`).join(' '));
console.log('suppliers:', Object.entries(out.suppliers).map(([k, v]) => `${k}=${(v.created || '?').slice(0, 10)}`).join(' '));
await browser.close();
