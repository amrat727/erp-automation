// Helper (not a test): READ-ONLY UI/UX crawl of every ERP screen. For each screen it records the same facts (toolbar,
// table, search, filters, paging, empty message, row click, deactivate popup, Add form + empty save, audit drawer) so they
// can be compared with the Core standard. EVERY save is BLOCKED (probe-lib); popups are always cancelled.
//   node scripts/probes/ui-consistency-crawl.mjs [path ...]   -> reports/ui-consistency/facts.json + screenshots/ui-consistency/*.png
import { open } from '../lib/probe-lib.mjs';
import fs from 'fs';

const OUT = 'reports/ui-consistency', SHOT = 'screenshots/ui-consistency';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHOT, { recursive: true });
const log = [];
const { browser, page } = await open({ log });
page.setDefaultTimeout(8000);
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
const vis = l => l.filter({ visible: true });
const main = () => page.locator('main');
const textOf = async l => clean(await l.innerText().catch(() => ''));
const slug = p => p.replace(/^\//, '').replace(/[^\w]+/g, '-') || 'root';

let screens = process.argv.slice(2).map(p => ({ menu: p, path: p }));
if (!screens.length) {
  const menu = fs.existsSync(`${OUT}/menu.json`) ? JSON.parse(fs.readFileSync(`${OUT}/menu.json`, 'utf8')) : [];
  const extra = JSON.parse(fs.readFileSync(`${OUT}/screens-extra.json`, 'utf8'));
  screens = [...new Map([...menu, ...extra].map(s => [s.path, s])).values()];
}
const facts = fs.existsSync(`${OUT}/facts-${process.env.BATCH || 'all'}.json`) ? JSON.parse(fs.readFileSync(`${OUT}/facts-${process.env.BATCH || 'all'}.json`, 'utf8')) : {};

async function step(f, name, fn) { try { f[name] = await fn(); } catch (e) { f[name] = { error: String(e).split('\n')[0].slice(0, 140) }; } }
async function closeAll() { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(250); } }

for (const s of screens) {
  const f = { menu: s.menu, path: s.path };
  console.log(`-- ${s.path}`);
  try {
    await page.goto(s.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await main().waitFor({ timeout: 60000 });
    await page.locator('main tbody tr, main [role=row], main h1, main h2').first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    f.url = new URL(page.url()).pathname;
    f.kind = await page.locator('main table').count() ? 'list' : 'page';
    await step(f, 'title', async () => clean(await vis(page.locator('main h1, main h2, main h3, main h4, main h5, main h6, main [class*=Title]')).first().innerText()));
    await step(f, 'toolbarButtons', async () => (await vis(main().locator('button')).allInnerTexts()).map(clean).filter(t => t && t.length < 35 && !/^\d+$/.test(t)).slice(0, 25));
    await page.screenshot({ path: `${SHOT}/${slug(s.path)}.png` });
    if (f.kind === 'list') {
      await step(f, 'headers', async () => (await page.locator('main thead th').allInnerTexts()).map(clean));
      await step(f, 'sortButtons', async () => (await page.locator('main thead [aria-label^="Sort by"], main thead button[title^="Sort"]').count()));
      await step(f, 'paging', async () => { const t = await textOf(main()); return { rowsPerPage: /Rows per page/i.test(t), range: (t.match(/\d+–\d+ of \d+/) || [''])[0], pageOf: (t.match(/Page \d+ of \d+/) || [''])[0] }; });
      await step(f, 'rows', async () => page.locator('main tbody tr').count());
      // sizes in pixels (rounded): table rows, header, toolbar buttons - compared with the Core standard
      await step(f, 'listSizes', async () => page.evaluate(() => {
        const h = el => el ? Math.round(el.getBoundingClientRect().height) : null;
        const m = document.querySelector('main');
        const rows = [...m.querySelectorAll('tbody tr')].slice(0, 3).map(h);
        const btn = [...m.querySelectorAll('button')].find(b => /^(\+\s*)?(Add|New|Create)\b/i.test((b.innerText || '').trim()) && b.offsetParent);
        const audit = [...m.querySelectorAll('button')].find(b => /^Audit history$/i.test((b.innerText || '').trim()) && b.offsetParent);
        const fs = el => el ? getComputedStyle(el).fontSize : null;
        return { rowHeight: rows[0] ?? null, rowHeights: rows, headerHeight: h(m.querySelector('thead tr')), addButtonHeight: h(btn), auditButtonHeight: h(audit), cellFont: fs(m.querySelector('tbody td')), headerFont: fs(m.querySelector('thead th')) };
      }));
      // header search: shown, or revealed by clicking a column title
      await step(f, 'search', async () => {
        let box = vis(page.locator('main thead input[placeholder]')).first();
        let how = 'visible';
        if (!(await box.isVisible().catch(() => false))) {
          const th = page.locator('main thead th').filter({ hasText: /\w/ });
          for (let i = 0; i < Math.min(await th.count(), 3); i++) { await th.nth(i).click({ position: { x: 30, y: 15 }, force: true }).catch(() => {}); await page.waitForTimeout(500); if (await box.isVisible().catch(() => false)) { how = 'opens on click'; break; } }
        }
        if (!(await box.isVisible().catch(() => false))) return { found: false };
        const placeholder = await box.getAttribute('placeholder');
        await box.fill('zzzqqq'); await page.waitForTimeout(3500);
        const mt = await textOf(main()); const body = (mt.match(/(There are no records[^.]*|No [a-z ]*(records|results|match)[^.]*.?|Nothing[^.]*.?)/i) || [''])[0] || (await textOf(page.locator('main tbody')));
        const range = ((await textOf(main())).match(/\d+–\d+ of \d+/) || [''])[0];
        await box.fill(''); await page.waitForTimeout(1500);
        return { found: true, how, placeholder, emptyMessage: body.slice(0, 120), range };
      });
      // Active / status filters in the header
      await step(f, 'filters', async () => {
        // the Status / Active filter opens when its column title is clicked, then its dropdown opens
        const out = [];
        const ths = page.locator('main thead th').filter({ hasText: /^(Status|Active)/ });
        for (let i = 0; i < Math.min(await ths.count(), 3); i++) {
          const th = ths.nth(i);
          const column = clean(await th.innerText().catch(() => '')).split(' ')[0];
          await th.click({ position: { x: 30, y: 15 }, force: true }).catch(() => {}); await page.waitForTimeout(600);
          await th.locator('[role=combobox]').first().click().catch(() => {}); await page.waitForTimeout(800);
          const opts = (await page.locator('[role=option], [role=listbox] li').allInnerTexts()).map(clean);
          await page.keyboard.press('Escape'); await page.waitForTimeout(300);
          out.push({ column, options: opts.slice(0, 10) });
        }
        return out;
      });
      await step(f, 'rowControls', async () => { const r = page.locator('main tbody tr').first(); return { switch: await r.locator('input[type=checkbox][role=switch], .MuiSwitch-root').count() > 0, share: await r.locator('button[aria-label*="hare" i], [data-testid*="Share" i]').count() > 0 || (await r.locator('button').count()) > 0 }; });
      // deactivate popup: only a switch that is ON (never touches OFF switches)
      await step(f, 'deactivatePopup', async () => {
        const on = page.locator('main tbody tr .MuiSwitch-root').filter({ has: page.locator('input:checked') }).first();
        if (!(await on.count())) return { tested: false, reason: 'no active switch' };
        await on.click(); await page.waitForTimeout(2500);
        const pop = page.locator('.swal2-popup, [role=dialog], [role=alertdialog]').filter({ visible: true }).last();
        if (!(await pop.isVisible().catch(() => false))) return { tested: true, popup: false };
        const t = await textOf(pop);
        const btns = (await vis(pop.locator('button')).allInnerTexts()).map(clean).filter(Boolean);
        await page.screenshot({ path: `${SHOT}/${slug(s.path)}-deactivate.png` });
        await pop.getByRole('button', { name: /^Cancel$/i }).first().click().catch(() => closeAll());
        await page.waitForTimeout(800);
        return { tested: true, popup: true, text: t.slice(0, 160), buttons: btns };
      });
      // row click
      await step(f, 'rowClick', async () => {
        const before = page.url();
        // click the first cell that holds text (the name), in its middle - like a user would
        await closeAll(); await page.goto(s.path); await page.locator('main tbody tr').first().waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(2500);
        const cell = page.locator('main tbody tr').first().locator('td').filter({ hasText: /[A-Za-z0-9]/ }).first();
        if (!(await cell.count())) return 'no rows';
        await cell.click().catch(() => {}); await page.waitForTimeout(2500);
        const dlg = page.locator('[role=dialog]').filter({ visible: true }).last();
        let r;
        if (await dlg.isVisible().catch(() => false)) r = { opens: 'dialog', title: (await textOf(dlg)).slice(0, 60) };
        else if (page.url() !== before) r = { opens: 'page', url: new URL(page.url()).pathname };
        else r = { opens: 'nothing' };
        await closeAll(); if (page.url() !== before) { await page.goto(s.path); await page.waitForTimeout(2500); }
        return r;
      });
      // audit drawer
      await step(f, 'audit', async () => {
        const b = vis(main().getByRole('button', { name: /^Audit history$/i })).first();
        if (!(await b.isVisible().catch(() => false))) return { button: false };
        await b.click(); await page.waitForTimeout(2000);
        const d = page.locator('[role=dialog], .MuiDrawer-paper').filter({ visible: true }).last();
        const t = await textOf(d);
        await closeAll();
        return { button: true, tabs: ['All', 'Created', 'Updated', 'Inactive', 'Deactivated'].filter(x => t.includes(x)), changes: (t.match(/\d+ changes?/) || [''])[0] };
      });
    }
    // Add form + empty save (the save request is blocked)
    await step(f, 'addForm', async () => {
      const add = vis(main().getByRole('button', { name: /^(\+\s*)?(Add|New|Create)\b/i })).first();
      if (!(await add.isVisible().catch(() => false))) return { button: null };
      const label = clean(await add.innerText());
      const before = page.url();
      await add.click(); await page.waitForTimeout(2500);
      const dlg = page.locator('[role=dialog]').filter({ visible: true }).last();
      const isDialog = await dlg.isVisible().catch(() => false);
      const scope = isDialog ? dlg : main();
      const heads = (await vis(scope.locator('h1, h2, h3, h4, h5, h6, [class*=Title]')).allInnerTexts()).map(clean).filter(Boolean);
      // the form title: a dialog's own title element, or (full page) the first text that starts with Add / New / Create
      const dTitle = isDialog ? clean(await vis(dlg.locator('.MuiDialogTitle-root, [id*=dialog-title], h2')).first().innerText().catch(() => '')).split(' ').slice(0, 6).join(' ') : '';
      const pTitle = isDialog ? '' : clean(await vis(main().getByText(/^(Add|New|Create) [A-Z][w ]*$/)).first().innerText().catch(() => ''));
      const title = dTitle || pTitle || heads.find(h => /^(Add|New|Create|Edit)/i.test(h)) || '(no form title found)';
      const buttons = (await vis(scope.locator('button')).allInnerTexts()).map(clean).filter(t => t && t.length < 30);
      const labels = (await vis(scope.locator('label, .MuiFormLabel-root')).allInnerTexts()).map(clean).filter(Boolean).slice(0, 20);
      // sizes in pixels (rounded) of the open form: input / dropdown heights, label font, buttons, dialog width
      const sizes = await (isDialog ? dlg : main()).evaluate(root => {
        const vis = el => el.offsetParent !== null && el.getBoundingClientRect().height > 0;
        const r = el => Math.round(el.getBoundingClientRect().height);
        const inputs = [...root.querySelectorAll('.MuiInputBase-root, .MuiOutlinedInput-root')].filter(vis).filter(el => !el.querySelector('textarea[rows], textarea:not([aria-hidden])') || r(el) < 70);
        const heights = inputs.map(r);
        const lbl = [...root.querySelectorAll('label, .MuiFormLabel-root')].find(vis);
        const btns = [...root.querySelectorAll('button')].filter(vis).filter(b => /^(Save|Cancel|Create|Add)\b/i.test((b.innerText || '').trim()));
        return { inputHeights: [...new Set(heights)].sort((a, b) => a - b), inputCount: heights.length, labelFont: lbl ? getComputedStyle(lbl).fontSize : null, buttonHeights: [...new Set(btns.map(r))], width: Math.round(root.getBoundingClientRect().width) };
      }).catch(e => ({ error: String(e).slice(0, 80) }));
      const sent = log.length;
      const save = vis(scope.getByRole('button', { name: /^(Save|Create|Add|Submit|Save .+|Create .+|Add .+)$/i })).filter({ hasNotText: /^Add (row|item|line)/i }).last();
      let saveLabel = null, enabled = null, messages = [], banner = [];
      if (await save.isVisible().catch(() => false)) {
        saveLabel = clean(await save.innerText()); enabled = await save.isEnabled();
        if (enabled) { await save.click().catch(() => {}); await page.waitForTimeout(2000); }
        messages = (await vis(page.locator('.MuiFormHelperText-root.Mui-error, .Mui-error .MuiFormHelperText-root, [class*=error]:not(input)')).allInnerTexts()).map(clean).filter(Boolean).slice(0, 12);
        banner = (await vis(page.locator('[role=alert], .MuiAlert-message, .swal2-popup')).allInnerTexts()).map(clean).filter(Boolean).slice(0, 4);
      }
      await page.screenshot({ path: `${SHOT}/${slug(s.path)}-add.png` });
      const r = { sizes, button: label, opens: isDialog ? 'dialog' : (page.url() !== before ? 'page' : 'same page'), title, buttons, labels, saveLabel, saveEnabledWhenEmpty: enabled, messages: [...new Set(messages)], banner, sentToServer: log.length - sent };
      await closeAll(); if (page.url() !== before) { await page.goto(s.path).catch(() => {}); }
      return r;
    });
  } catch (e) { f.error = String(e).split('\n')[0].slice(0, 160); }
  facts[s.path] = f;
  fs.writeFileSync(`${OUT}/facts-${process.env.BATCH || 'all'}.json`, JSON.stringify(facts, null, 1));
}
console.log(`done: ${Object.keys(facts).length} screens | blocked saves: ${log.length}`);
await browser.close();
