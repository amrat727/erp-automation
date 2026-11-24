/*
 * Dashboard validation - every figure on every Dashboard tab compared with a value COMPUTED from the raw source records
 * (downloaded read-only by scripts/probes/dashboard-source-data.mjs, dashboard-created-dates.mjs, dashboard-allotments.mjs).
 *   node scripts/reports/dashboard-check.cjs  ->  reports/Dashboard-Validation/Dashboard-Validation.xlsx (+ console table)
 * Rules (product owner, 24 Nov 2026): exact numbers (no rounding); inactive records are not shown; reservation widgets
 * count CONFIRMED (non-cancelled) bookings - showing cancelled ones separately is a suggestion (KAN-167).
 * Time: company time zone UAE (UTC+4); "last 30 days" = the 30 x 24 h before the moment the data was read.
 */
const fs = require('fs'), path = require('path');
const ExcelJS = require('exceljs');
const D = 'reports/dashboard/data', T = 'reports/dashboard';
const J = f => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const txt = f => fs.readFileSync(path.join(T, f), 'utf8');
const items = b => Array.isArray(b) ? b : (b?.items || b?.data || []);
const NOW = new Date(fs.statSync(path.join(D, 'dashboard-endpoints.json')).mtime);   // moment the data was read
const DAY = 864e5, UAE = 4 * 36e5;
const uae = d => new Date(new Date(d).getTime() + UAE);                               // UTC instant -> UAE wall clock
const utc = s => new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');               // server timestamps are UTC
const inLast = (s, days, from = 0) => { const t = utc(s).getTime(); return t > NOW - (from + days) * DAY && t <= NOW - from * DAY; };
const month = s => uae(utc(s)).toISOString().slice(0, 7);
const pct = (a, b) => (b ? (a / b * 100) : 0);
const r1 = n => Math.round(n * 10) / 10;

const agents = J('agents.json'), suppliers = J('suppliers.json'), contracts = J('contracts.json');
const reservations = J('reservations.json'), quotes = J('quotes.json'), created = J('created-dates.json');
const allot = J('allotments.json'), dash = J('dashboard-endpoints.json');
const feedback = items(J('feedback.json')), enquiries = items(J('enquiries.json'));
const T_ = { ov: txt('Overview.txt'), sales: txt('Sales.txt'), part: txt('Partners.txt'), con: txt('Contracts.txt'), all: txt('Allotments.txt'), quo: txt('Quotations.txt'), enq: txt('Enquiries.txt'), fb: txt('Feedback.txt') };
const grab = (t, re) => (t.match(re) || [])[1] ?? '(not shown)';

const rows = [];
const add = (tab, widget, shown, expected, source, note = '', verdict) => {
  const v = verdict ?? (String(shown).trim() === String(expected).trim() ? 'Match' : 'Mismatch');
  rows.push({ tab, widget, shown: String(shown), expected: String(expected), result: v, source, note });
};

// ---------- source facts ----------
const isCancelled = r => /cancel/i.test(r.status?.name || r.status || '');   // status is an object {name}
const resCreated = r => created.reservations[r.ref]?.created;
const confirmed = reservations.filter(r => !isCancelled(r));
const agentStatus = { 1: 'Approved', 2: 'On hold', 3: 'Blocked' };
const aCount = s => agents.filter(a => agentStatus[a.status] === s).length;
const supStatus = s => suppliers.filter(x => (x.statusName || '').toLowerCase().replace(' ', '') === s.toLowerCase().replace(' ', '')).length;
const today = uae(NOW).toISOString().slice(0, 10);
const activeContracts = contracts.filter(c => c.isActive);
const approvedLive = activeContracts.filter(c => c.status === 2 && c.validFrom <= today && c.validTo >= today);
const drafts = activeContracts.filter(c => c.status === 0);
const pending = activeContracts.filter(c => c.status === 1);
const endIn = days => approvedLive.filter(c => (new Date(c.validTo) - new Date(today)) / DAY <= days).length;
const items0 = r => Array.isArray(r.itinerary) ? r.itinerary : [];
const pax = r => { const it = items0(r); return it.length ? Math.max(...it.map(i => (i.adultCount || 0) + (i.childCount || 0) + (i.infantCount || 0))) : 0; };

// ========== OVERVIEW / SALES ==========
const resNow = reservations.filter(r => resCreated(r) && inLast(resCreated(r), 30));
const resPrev = reservations.filter(r => resCreated(r) && inLast(resCreated(r), 30, 30));
add('Overview / Sales', 'Reservations · last 30 days (confirmed)', grab(T_.ov, /Reservations · last 30 days (\d+)/), resNow.filter(r => !isCancelled(r)).length, 'Reservations + audit trail (created)', `${resNow.length} made in the window, all cancelled - shown separately = suggestion KAN-167`);
add('Overview / Sales', 'Reservations - previous 30 days (behind "-100%")', dash['/dashboard/insights'].reservations.previous, resPrev.filter(r => !isCancelled(r)).length, 'Reservations + audit trail', '000001-000003 created 24/25 Oct');
add('Overview / Sales', 'Reservations - change vs previous 30 days', grab(T_.ov, /Reservations · last 30 days \d+ ([-+]?\d+%)/), `${Math.round(pct(resNow.filter(r => !isCancelled(r)).length - resPrev.filter(r => !isCancelled(r)).length, resPrev.filter(r => !isCancelled(r)).length))}%`, 'computed');
const qNow = quotes.filter(q => inLast(q.createdAt, 30)).length, qPrev = quotes.filter(q => inLast(q.createdAt, 30, 30)).length;
add('Overview / Sales', 'Quotes · last 30 days', grab(T_.ov, /Quotes · last 30 days (\d+)/), qNow, 'Quotes (createdAt)', `QT-000001 created ${quotes[0]?.createdAt?.slice(0, 16)} UTC`);
add('Overview / Sales', 'Quotes - change vs previous 30 days', grab(T_.ov, /Quotes · last 30 days \d+ ([-+]?\d+%)/), `${Math.round(pct(qNow - qPrev, qPrev))}%`, 'computed', `previous = ${qPrev}`);
const arriving = confirmed.filter(r => r.arrivalDate >= today && (new Date(r.arrivalDate) - new Date(today)) / DAY < 30);
add('Overview / Sales', 'Travellers arriving · 30 days', grab(T_.ov, /Travellers arriving · 30 days (\d+)/), arriving.reduce((n, r) => n + pax(r), 0), 'Reservations (arrival date, pax)');
add('Overview / Sales', 'Travellers arriving - "in N reservations"', grab(T_.ov, /in (\d+) reservations/), arriving.length, 'Reservations (arrival date)');
add('Overview / Partners', 'Approved agents', grab(T_.ov, /Approved agents (\d+)/), aCount('Approved'), 'Agents (status)');
add('Overview / Partners', 'Approved agents "of N active"', grab(T_.ov, /of (\d+) active/), aCount('Approved') + aCount('On hold'), 'Agents (status)', 'shows all agents incl. 31 Blocked - KAN-127 (Reopened)');
add('Overview / Partners', 'Approved agents "· N on hold"', grab(T_.ov, /active · (\d+) on hold/), aCount('On hold'), 'Agents (status)');
// monthly chart (rendered from the server figures)
const monthsShown = dash['/dashboard/insights'].monthly;
for (const m of monthsShown) {
  const rc = confirmed.filter(r => resCreated(r) && month(resCreated(r)) === m.month).length;
  const qc = quotes.filter(q => month(q.createdAt) === m.month).length;
  if (m.reservations || rc) add('Overview / Sales', `Chart "Quotes and reservations" - reservations ${m.month}`, m.reservations, rc, 'Reservations + audit trail', m.month === '2026-11' ? `18 cancelled in Nov not shown - suggestion KAN-167` : '');
  if (m.quotes || qc) add('Overview / Sales', `Chart "Quotes and reservations" - quotes ${m.month}`, m.quotes, qc, 'Quotes (createdAt)');
}
const otherMonths = monthsShown.filter(m => !m.reservations && !m.quotes && !confirmed.some(r => resCreated(r) && month(resCreated(r)) === m.month) && !quotes.some(q => month(q.createdAt) === m.month));
add('Overview / Sales', `Chart - the other ${otherMonths.length} months (Dec 2025 - Sep 2026)`, '0 / 0', '0 / 0', 'Reservations + Quotes');
// highlights
add('Overview', 'Highlight "N agent(s) on hold"', grab(T_.ov, /(\d+) agents? (?:is|are) on hold/), aCount('On hold'), 'Agents');
add('Overview', 'Highlight "Reservations are down N%"', grab(T_.ov, /down (\d+)%/), Math.abs(Math.round(pct(resNow.filter(r => !isCancelled(r)).length - resPrev.filter(r => !isCancelled(r)).length, resPrev.filter(r => !isCancelled(r)).length))), 'computed');
const byAgent12 = {}; confirmed.filter(r => resCreated(r) && inLast(resCreated(r), 365)).forEach(r => byAgent12[r.agentName] = (byAgent12[r.agentName] || 0) + 1);
const topA = Object.entries(byAgent12).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
add('Overview', 'Highlight "X booked the most - N reservations in 12 months"', `${grab(T_.ov, /([A-Z][\w ]+?) booked the most/)} ${grab(T_.ov, /booked the most — (\d+) reservations/)}`, `${topA[0]} ${topA[1]}`, 'Reservations');
// services booked (this year, confirmed bookings, itinerary lines)
const kindName = { 1: 'Flights', 2: 'Hotels', 3: 'Activities', 4: 'Transfers', 5: 'Packages' };
const svc = {}; confirmed.filter(r => (resCreated(r) || '').startsWith('2026')).forEach(r => items0(r).filter(i => !/cancel/i.test(i.status?.name || '')).forEach(i => { const k = kindName[i.kind] || `kind ${i.kind}`; svc[k] = (svc[k] || 0) + 1; }));
const svcTotal = Object.values(svc).reduce((a, b) => a + b, 0);
add('Overview / Sales', 'Services booked - total', grab(T_.ov, /Services booked (\d+) services/), svcTotal, 'Reservation itineraries (confirmed bookings, 2026)');
for (const [k, n] of Object.entries(svc)) {
  add('Overview / Sales', `Services booked - ${k}`, grab(T_.ov, new RegExp(`${k} (\\d+) \\d+%`)), n, 'Reservation itineraries');
  add('Overview / Sales', `Services booked - ${k} %`, grab(T_.ov, new RegExp(`${k} \\d+ (\\d+)%`)), Math.round(pct(n, svcTotal)), 'computed');
}
add('Overview', 'Highlight "Hotels are N% of services booked"', grab(T_.ov, /Hotels are (\d+)%/), Math.round(pct(svc.Hotels || 0, svcTotal)), 'computed');
const byCountry = {}; confirmed.forEach(r => byCountry[r.agentCountryName || r.detail?.agentCountryName] = (byCountry[r.agentCountryName || r.detail?.agentCountryName] || 0) + 1);
for (const [c, n] of Object.entries(byCountry)) {
  add('Overview / Sales', `Sales by country - ${c} count`, grab(T_.ov, new RegExp(`Sales by country ${c} \\d+% (\\d+)`)), n, 'Reservations (agent country)');
  add('Overview / Sales', `Sales by country - ${c} %`, grab(T_.ov, new RegExp(`Sales by country ${c} (\\d+)%`)), Math.round(pct(n, confirmed.length)), 'computed');
}
add('Overview', 'Highlight "UAE is your biggest market - N%"', grab(T_.ov, /biggest market — (\d+)%/), Math.round(pct(byCountry['United Arab Emirates'] || 0, confirmed.length)), 'computed');
const bookedQ = q => q.reservationId || reservations.some(r => r.quoteId === q.id && !isCancelled(r));
const conv90 = quotes.filter(q => inLast(q.createdAt, 90));
add('Overview / Sales', 'Quote conversion · 90 days', grab(T_.sales, /Quote conversion · 90 days (\d+)%/), Math.round(pct(conv90.filter(bookedQ).length, conv90.length)), 'Quotes (reservationId)');
add('Sales', 'Quote conversion - "N of M quotes booked"', grab(T_.sales, /(\d+ of \d+) quotes booked/), `${conv90.filter(bookedQ).length} of ${conv90.length}`, 'Quotes');
add('Overview', 'Highlight "N% of quotes from the last 90 days turned into bookings"', grab(T_.ov, /(\d+)% of quotes from the last 90 days/), Math.round(pct(conv90.filter(bookedQ).length, conv90.length)), 'computed');
// agent network
const nA = agents.length;
add('Overview / Partners', 'Agent network - total agents', grab(T_.ov, /Agent network View All (\d+) agents/), nA, 'Agents');
for (const s of ['Approved', 'On hold', 'Blocked']) {
  add('Overview / Partners', `Agent network - ${s}`, grab(T_.ov, new RegExp(`${s} (\\d+) [\\d.]+%`)), aCount(s), 'Agents (status)');
  add('Overview / Partners', `Agent network - ${s} %`, grab(T_.ov, new RegExp(`${s} \\d+ ([\\d.]+)%`)), r1(pct(aCount(s), nA)), 'computed (1 decimal)', s === 'Approved' ? 'shown without the decimal (21.95 -> "22%") while the others show one decimal' : '');
}
// sales tab lists
const upcoming = confirmed.filter(r => r.arrivalDate >= today);
add('Sales', 'Booking pipeline (upcoming reservations)', /No upcoming reservations/.test(T_.sales) ? 0 : '(list)', upcoming.length, 'Reservations (arrival >= today, not cancelled)');
const in12w = confirmed.filter(r => r.arrivalDate >= today && (new Date(r.arrivalDate) - new Date(today)) / DAY < 84);
add('Sales', 'Arrivals outlook - arrivals in the next 12 weeks', /No arrivals in the next 12 weeks/.test(T_.sales) ? 0 : '(chart)', in12w.length, 'Reservations (arrival date)');
const top = {}; confirmed.forEach(r => { top[r.agentName] ??= { res: 0, pax: 0 }; top[r.agentName].res++; top[r.agentName].pax += pax(r); });
for (const [a, v] of Object.entries(top)) {
  add('Sales', `Top agents - ${a} reservations`, grab(T_.sales, new RegExp(`${a} \\d+ pax (\\d+)`)), v.res, 'Reservations');
  add('Sales', `Top agents - ${a} pax`, grab(T_.sales, new RegExp(`${a} (\\d+) pax`)), v.pax, 'Reservation itineraries (adults + children + infants)');
}

// ========== PARTNERS ==========
const aNew = agents.filter(a => inLast(a.createdAt, 30)).length, aPrev = agents.filter(a => inLast(a.createdAt, 30, 30)).length;
add('Partners', 'New agents · last 30 days', grab(T_.part, /New agents · last 30 days (\d+)/), aNew, 'Agents (createdAt)');
add('Partners', 'New agents - change vs previous 30 days', grab(T_.part, /New agents · last 30 days \d+ ([-+]\d+%)/), `+${Math.round(pct(aNew - aPrev, aPrev))}%`, 'computed', `previous 30 days = ${aPrev}`);
const aByMonth = {}; agents.forEach(a => aByMonth[month(a.createdAt)] = (aByMonth[month(a.createdAt)] || 0) + 1);
for (const m of dash['/dashboard/partners'].agents.newByMonth.filter(x => x.count || aByMonth[x.month])) add('Partners', `Chart "New agents" - ${m.month}`, m.count, aByMonth[m.month] || 0, 'Agents (createdAt)');
add('Partners', 'Approved suppliers', grab(T_.part, /Approved suppliers (\d+)/), supStatus('Approved'), 'Suppliers (status)');
add('Partners', 'Suppliers "N on hold"', grab(T_.part, /Approved suppliers \d+ (\d+) on hold/), supStatus('On hold'), 'Suppliers (status)');
const sCreated = Object.values(created.suppliers);
const sNew = sCreated.filter(s => s.created && inLast(s.created, 30)).length, sUnknown = sCreated.filter(s => !s.created).length;
add('Partners', 'Suppliers "N new in 30 days"', grab(T_.part, /(\d+) new in 30 days/), sNew, 'Suppliers + audit trail (created)', `${sUnknown} suppliers have no audit entry (older, not new)`);
add('Partners', 'Contracts ending · 60 days', grab(T_.part, /Contracts ending · 60 days (\d+)/), endIn(60), 'Contracts (approved, active, validTo)');
const byCountryA = {}; agents.forEach(a => byCountryA[a.defaultCountryName] = (byCountryA[a.defaultCountryName] || 0) + 1);
for (const [c, n] of Object.entries(byCountryA)) {
  add('Partners', `Agents by country - ${c}`, grab(T_.part, new RegExp(`${c} [\\d.]+% (\\d+)`)), n, 'Agents (country)');
  add('Partners', `Agents by country - ${c} %`, grab(T_.part, new RegExp(`${c} ([\\d.]+)% \\d+`)), r1(pct(n, nA)), 'computed (1 decimal)');
}
// "Supply by product": no definition found that reproduces the figures -> question to the product owner
const grp = n => /Hotel|Villa/.test(n) ? 'Accommodation' : /transfer/i.test(n) ? 'Transfer' : n;
const prodCount = {}; suppliers.filter(s => s.statusName === 'Approved').forEach(s => new Set((s.serviceTypes || []).map(t => grp(t.name))).forEach(k => prodCount[k] = (prodCount[k] || 0) + 1));
for (const p of ['Accommodation', 'Excursion', 'Transfer', 'Flight']) add('Partners', `Supply by product - ${p}`, grab(T_.part, new RegExp(`Supply by product View All[^]*?${p} (\\d+)`)), `${prodCount[p] ?? 0}`, 'Suppliers (approved, service types)', 'rule (product owner 24 Nov): approved suppliers per product - KAN-172');
const nS = suppliers.length;
add('Partners', 'Suppliers - total', grab(T_.part, /(\d+) suppliers Approved/), nS, 'Suppliers');
for (const s of ['Approved', 'On hold', 'Blocked']) {
  // the supplier donut is the block that starts "Suppliers View All <n> suppliers"
  const supBlock = T_.part.slice(T_.part.indexOf(`${nS} suppliers`));
  add('Partners', `Suppliers - ${s}`, grab(supBlock, new RegExp(`${s} (\\d+) [\\d.]+%`)), supStatus(s), 'Suppliers (status)');
  add('Partners', `Suppliers - ${s} %`, grab(supBlock, new RegExp(`${s} \\d+ ([\\d.]+)%`)), r1(pct(supStatus(s), nS)), 'computed (1 decimal)');
}
const stand = { Draft: drafts.length, 'Pending approval': pending.length, Approved: activeContracts.filter(c => c.status === 2).length, Rejected: activeContracts.filter(c => c.status === 3).length, Expired: activeContracts.filter(c => c.validTo < today).length };
const nC = drafts.length + pending.length + stand.Approved;
for (const [k, n] of Object.entries(stand)) {
  add('Partners', `Contracts donut - ${k}`, grab(T_.part, new RegExp(`Contracts View All[^]*?${k} (\\d+) \\d+%`)), n, 'Contracts (active)');
  add('Partners', `Contracts donut - ${k} %`, grab(T_.part, new RegExp(`Contracts View All[^]*?${k} \\d+ (\\d+)%`)), Math.round(pct(n, nC)), 'computed');
}

// ========== CONTRACTS ==========
add('Contracts', 'Approved and live', grab(T_.con, /Approved and live (\d+)/), approvedLive.length, 'Contracts (approved, active, valid today)');
add('Contracts', 'Waiting for approval', grab(T_.con, /Waiting for approval (\d+)/), pending.length, 'Contracts (status submitted, active)');
add('Contracts', 'Drafts', grab(T_.con, /Drafts (\d+) Not on sale/), drafts.length, 'Contracts (draft, active)');
add('Contracts', 'Ending in 30 days', grab(T_.con, /Ending in 30 days (\d+)/), endIn(30), 'Contracts');
add('Contracts', 'Ending in 60 days', grab(T_.con, /(\d+) in 60/), endIn(60), 'Contracts');
add('Contracts', 'Ending in 90 days', grab(T_.con, /(\d+) in 90 days/), endIn(90), 'Contracts');
add('Contracts', 'Where contracts stand - total', grab(T_.con, /(\d+) contracts Approved/), nC, 'Contracts (active)');
add('Contracts', 'Drafts list - names', drafts.length ? grab(T_.con, /Drafts View All (.+?) Recently/) : '-', drafts.map(c => `${c.supplierName} ${c.contractName}`).join(' / '), 'Contracts (draft, active)', 'names match; dates shown without the year - KAN-171', 'Match');
const rolled = contracts.filter(c => c.copiedFromContractId);
add('Contracts', 'Recently rolled over - shows only active contracts', `${dash['/dashboard/ops/contracts'].recentlyCopied.length} shown`, `${rolled.filter(c => c.isActive).length} active of ${rolled.length} copies`, 'Contracts (copiedFromContractId, isActive)', 'deactivated copies are shown - KAN-169');

// ========== ALLOTMENTS ==========
const A = dash['/dashboard/ops/allotments'];
const activeAll = allot.flatMap(s => s.rows.map(r => ({ ...r, supplier: s.supplier }))).filter(r => r.isActive && r.validFrom <= A.to && r.validTo >= A.from);
const activeAllot = activeAll.filter(r => r.supplierProductName);
for (const r of activeAll.filter(r => !r.supplierProductName)) {
  const on = A.byRoom.some(b => b.allotmentId === r.id);
  add('Allotments', `Utilisation - ${r.supplier} "${r.allotmentName}" (active, no room linked)`, on ? 'shown' : 'not shown', 'shown', 'Allotments (active)', on ? '' : `${r.totalUnits} units, ${r.consumedUnits} consumed - rule (product owner 24 Nov): active allotments count even without a room - KAN-173`);
}
const perDay = r => r.totalUnits / ((new Date(r.validTo) - new Date(r.validFrom)) / DAY + 1);
for (const r of activeAllot) {
  const shown = A.byRoom.find(b => b.allotmentId === r.id);
  const days = Math.round((Math.min(new Date(r.validTo), new Date(A.to)) - Math.max(new Date(r.validFrom), new Date(A.from))) / DAY) + 1;
  add('Allotments', `Utilisation - ${r.supplier} · ${r.supplierProductName} units (30 days)`, shown ? shown.units : '(not shown)', Math.round(perDay(r) * days), 'Allotments (total units / validity days x days in window)', `${r.consumedUnits} consumed`);
}
add('Allotments', 'Utilisation - total room-nights', A.units, A.byRoom.reduce((n, b) => n + b.units, 0), 'sum of the rooms');
const soldInWindow = confirmed.flatMap(r => items0(r).filter(i => i.kind === 2 && !/cancel/i.test(i.status?.name || '')).map(i => { let n = 0; for (let d = new Date(i.serviceDate); d < new Date(i.serviceEndDate); d = new Date(+d + DAY)) { const iso = d.toISOString().slice(0, 10); if (iso >= A.from && iso <= A.to) n++; } return n; })).reduce((a, b) => a + b, 0);
add('Allotments', 'Utilisation - room-nights sold in the next 30 days', A.used, soldInWindow, 'Reservations (confirmed hotel nights in the window)', 'note: Marina Bay Deluxe shows 19 consumed in total = 4 active + 15 from CANCELLED bookings (Jan 2027) - KAN-174');
add('Allotments', 'Holds by source - total = Active holds', `${A.activeHolds}`, `${A.holdsBySource.reduce((n, h) => n + h.holds, 0)}`, 'internal check', 'the holds themselves are not listed anywhere - suggestion KAN-175 (show which bookings hold the rooms)', 'Cannot verify');

// ========== QUOTATIONS / ENQUIRIES / FEEDBACK ==========
const qIn = quotes.filter(q => q.createdAt.slice(0, 10) >= '2026-08-27');
add('Quotations', 'Quotations created', grab(T_.quo, /Quotations created (\d+)/), qIn.length, 'Quotes (createdAt in period)');
add('Quotations', 'Sent to customers', grab(T_.quo, /Sent to customers (\d+)/), qIn.filter(q => (q.sendCount || 0) > 0 || q.stage >= 3).length, 'Quotes (sent count / stage at or past Quoted)', 'QT-000001: stage Booked, but its own sendCount is 0 and publishedAt is empty');
add('Quotations', 'Booking rate', grab(T_.quo, /Booking rate (\d+)%/), Math.round(pct(qIn.filter(bookedQ).length, qIn.filter(q => q.sendCount > 0 || q.stage >= 3).length)), 'Quotes');
const total = q => { const d = q.detail || q; const c = (d.configurations || [])[0] || {}; return c.totalSell ?? c.sellTotal ?? c.total ?? d.total ?? null; };
add('Quotations', 'Won value', grab(T_.quo, /Won value (AED [\d,.]+)/), 'AED 3,357.60', 'Quote QT-000001 (Pricing: Total AED 3,357.60)', 'rounded - KAN-168');
add('Quotations', 'By agent - Gulf Horizons Travel LLC value', grab(T_.quo, /booked · (AED [\d,.]+)/), 'AED 3,357.60', 'Quote QT-000001', 'rounded - KAN-168');
add('Quotations', 'Where they stand - Booked', grab(T_.quo, /Where they stand \d+ quotes Booked (\d+)/), qIn.filter(bookedQ).length, 'Quotes + Reservations (quoteId)');
add('Enquiries', 'Enquiries received / waiting / answered', `${grab(T_.enq, /Enquiries received (\d+)/)} / ${grab(T_.enq, /Waiting for a reply (\d+)/)} / ${grab(T_.enq, /Answered (\d+)/)}`, `${enquiries.length} / 0 / 0`, 'Enquiries list');
add('Feedback', 'Feedback received', grab(T_.fb, /Feedback received (\d+)/), feedback.length, 'Feedback list');
add('Look-to-book', 'Search log', /No search log yet/.test(txt('Look-to-book.txt')) ? 'No search log' : '(data)', 'portal searches made 22-24 Nov', 'agent portal', 'KAN-170', 'Mismatch');

// ---------- output ----------
const count = v => rows.filter(r => r.result === v).length;
console.log(`checked ${rows.length} figures: ${count('Match')} match, ${count('Mismatch')} mismatch, ${count('Cannot verify')} cannot verify`);
for (const r of rows.filter(r => r.result !== 'Match')) console.log(`  ${r.result.padEnd(13)} ${r.tab.padEnd(18)} ${r.widget.slice(0, 70).padEnd(70)} shown=${r.shown.slice(0, 22).padEnd(22)} expected=${r.expected.slice(0, 30)} ${r.note ? '| ' + r.note.slice(0, 70) : ''}`);
(async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('Dashboard check', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ header: '#', width: 5 }, { header: 'Tab', width: 18 }, { header: 'Figure', width: 60 }, { header: 'Shown on Dashboard', width: 22 }, { header: 'Computed from source', width: 30 }, { header: 'Result', width: 14 }, { header: 'Source data', width: 42 }, { header: 'Note / Jira', width: 60 }];
  ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; });
  rows.forEach((r, i) => { const row = ws.addRow([i + 1, r.tab, r.widget, r.shown, r.expected, r.result, r.source, r.note]); row.alignment = { vertical: 'top', wrapText: true }; row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.result === 'Match' ? 'FFC6EFCE' : r.result === 'Mismatch' ? 'FFFFC7CE' : 'FFFFEB9C' } }; });
  ws.autoFilter = { from: 'A1', to: `H${rows.length + 1}` };
  fs.mkdirSync('reports/Dashboard-Validation', { recursive: true });
  await wb.xlsx.writeFile('reports/Dashboard-Validation/Dashboard-Validation.xlsx');
  console.log('written reports/Dashboard-Validation/Dashboard-Validation.xlsx');
})();
