#!/usr/bin/env bash
# Re-run after a full core run: part 1 completely (it had crashes / "did not run"), parts 2-4 only their failed tests.
# Each part gets a fresh login first. Results -> full-run/rerun-<part>.txt|json, summary -> full-run/rerun-summary.txt
cd "$(dirname "$0")/../.."
: > full-run/rerun-summary.txt
login() { PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-fork npx playwright test --project=setup --output=test-results-fork-setup --reporter=line > /dev/null 2>&1; }
run() {   # name, extra args...
  local n=$1; shift
  login
  local start=$(date +%H:%M)
  PLAYWRIGHT_JSON_OUTPUT_NAME="full-run/rerun-$n.json" PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-fork \
    npx playwright test "$@" --project=core --no-deps --workers=2 --output="test-results-fork-$n" --reporter=line,json > "full-run/rerun-$n.txt" 2>&1
  echo "$n [$start-$(date +%H:%M)] $(grep -aE "^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)" "full-run/rerun-$n.txt" | tr -s ' ' | tr '\n' ' ')" | tee -a full-run/rerun-summary.txt
}
run core-ui1 accounts-ui application-ui organization-ui
run core-ui2 --last-failed
run core-crud --last-failed
run core-rest --last-failed
echo "ALL DONE $(date +%H:%M)" >> full-run/rerun-summary.txt
