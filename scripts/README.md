# scripts/

Helpers around the Playwright suite. None of these are tests - the tests live in `tests/<module>/`.
Run every script from the repository root (paths like `reports/...` and `playwright/.auth/...` are relative to it).

| Folder | What is in it | Example |
|---|---|---|
| `run/` | Run the whole suite in parts, a fresh login per part | `bash scripts/run/full-run.sh 2 core-ui1 supplier` |
| `reports/` | Build the Excel files: bug report, question sheets, UI text audit, Linear descriptions | `npm run bug-report` |
| `evidence/` | Take bug / fix screenshots for the report and Linear (read-only) | `ONLY=BUG-09 node scripts/evidence/evidence-core-fixes.mjs` |
| `data/` | Create / block the standing QA test data (B2B agent) | `node scripts/data/block-agent.mjs 33` |
| `probes/` | One-off checks used while investigating a screen or a bug (read-only unless stated in the file) | `node scripts/probes/probe-header.mjs` |
| `lib/` | `probe-lib.mjs` - opens a logged-in browser that BLOCKS every save unless `allowWrites: true` | imported by the scripts above |

Safety: probes and evidence scripts block writes through `lib/probe-lib.mjs`. The few that change data say so in their
first comment and only touch "QA Auto ..." records.
