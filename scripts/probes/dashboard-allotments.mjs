// Helper (not a test): READ-ONLY - downloads the allotments of every supplier and service type (GET only)
// -> reports/dashboard/data/allotments.json
//   node scripts/probes/dashboard-allotments.mjs
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
const out = [];
for (const s of JSON.parse(fs.readFileSync(`${D}/suppliers.json`, 'utf8'))) {
  for (const t of [1, 2, 3, 4, 5, 6]) {
    const b = await get(`/suppliers/${s.id}/service-types/${t}/allotments?activeOnly=false`);
    const rows = Array.isArray(b) ? b : (b?.items || []);
    if (rows.length) out.push({ supplierId: s.id, supplier: s.name, supplierStatus: s.statusName ?? s.status, serviceType: t, rows });
  }
}
fs.writeFileSync(`${D}/allotments.json`, JSON.stringify(out, null, 1));
console.log(`allotments: ${out.length} supplier/service sets, ${out.reduce((n, x) => n + x.rows.length, 0)} records`);
const first = out[0]?.rows[0];
console.log('record keys:', Object.keys(first || {}).join(','));
console.log('sample:', JSON.stringify(first || {}).slice(0, 900));
await browser.close();
