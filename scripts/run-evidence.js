// Runs the bug-evidence specs (they only run with EVIDENCE=1) on Windows and Linux alike, then rebuilds the bug report.
//   npm run evidence                 -> every *-bug-evidence spec
//   npm run evidence -- BUG-9        -> only titles matching "BUG-9"
const { spawnSync } = require('child_process');
const grep = process.argv[2];
const args = ['playwright', 'test', 'bug-evidence', ...(grep ? ['--grep', grep] : [])];
const run = spawnSync('npx', args, { stdio: 'inherit', shell: true, env: { ...process.env, EVIDENCE: '1' } });
spawnSync('node', ['scripts/bug-report.js'], { stdio: 'inherit', shell: true });
process.exit(run.status ?? 1);
