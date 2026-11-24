// Helper (not a test): READ-ONLY - downloads the raw source records behind the Dashboard with GET calls made by the
// signed-in app page (same token), plus what the Dashboard endpoints return -> reports/dashboard/data/*.json.
// Nothing is written to the ERP (only GET; probe-lib blocks every other method).
//   node scripts/probes/dashboard-source-data.mjs
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const OUT = 'reports/dashboard/data'; fs.mkdirSync(OUT, { recursive: true });
const { browser, page } = await open({});
page.setDefaultTimeout(60000);
let api = '';
page.on('request', r => { const m = r.url().match(/^(https:\/\/[^/]*pilottest[^/]*)\//); if (m) api = m[1]; });
await page.goto('/dashboard'); await page.waitForTimeout(8000);
const get = async (path) => page.evaluate(async ([base, p]) => {
  const tok = sessionStorage.getItem('token') || sessionStorage.getItem('accessToken') || '';
  const r = await fetch(base + p, { headers: { Authorization: `Bearer ${tok.replace(/^"|"$/g, '')}`, Accept: 'application/json' } });
  return { status: r.status, body: r.ok ? await r.json().catch(() => null) : await r.text() };
}, [api, path]);
const items = b => Array.isArray(b) ? b : (b?.items || b?.data || b?.results || []);
const save = (n, v) => { fs.writeFileSync(`${OUT}/${n}.json`, JSON.stringify(v, null, 1)); };
const log = (n, v) => console.log(`${n}: ${Array.isArray(v) ? v.length + ' records' : typeof v}`);

const agents = items((await get('/agent/agents?page=1&pageSize=1000')).body); save('agents', agents); log('agents', agents);
const suppliersList = items((await get('/supplier/suppliers?page=1&pageSize=1000')).body);
const suppliers = [];
for (const s of suppliersList) suppliers.push({ ...s, detail: (await get(`/suppliers/${s.id}`)).body });
save('suppliers', suppliers); log('suppliers', suppliers);
let c = await get('/suppliers/services/contracts?page=1&pageSize=1000');
const contracts = items(c.body); save('contracts', contracts); log('contracts (all)', contracts);
const resList = items((await get('/reservations?page=1&pageSize=1000')).body);
const reservations = [];
for (const r of resList) reservations.push({ ...r, detail: (await get(`/reservations/${r.id}`)).body, itinerary: (await get(`/reservations/${r.id}/itinerary`)).body });
save('reservations', reservations); log('reservations', reservations);
const quotesList = items((await get('/quotes?page=1&pageSize=1000')).body);
const quotes = [];
for (const q of quotesList) quotes.push({ ...q, detail: (await get(`/quotes/${q.id}`)).body });
save('quotes', quotes); log('quotes', quotes);
const feedback = (await get('/crm/feedback?rating=&search=')).body; save('feedback', feedback); log('feedback', items(feedback));
const enquiries = (await get('/crm/enquiries?page=1&pageSize=1000')).body; save('enquiries', enquiries); log('enquiries', items(enquiries));
// what the Dashboard itself is fed
const d = {};
for (const p of ['/dashboard/insights', '/dashboard/partners', '/dashboard/ops/contracts', '/dashboard/ops/allotments', '/dashboard/ops/quotations?from=2026-08-27&to=2026-11-24', '/dashboard/ops/feedback?from=2026-08-27&to=2026-11-24', '/dashboard/ops/enquiries?from=2026-08-27&to=2026-11-24']) d[p] = (await get(p)).body;
save('dashboard-endpoints', d); console.log('dashboard endpoints:', Object.keys(d).length);
console.log('api base:', api ? 'found' : 'MISSING');
await browser.close();
