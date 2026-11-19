#!/usr/bin/env bash
# Full regression, one chunk at a time, with a FRESH login before each chunk
# (the ERP session only lasts ~2 hours; core alone takes longer, so it is split in 4 chunks).
#   bash scripts/full-run.sh [workers] [chunk ...]
# A chunk is a project name, or one of the core chunks: core-ui1 core-ui2 core-crud core-rest
# Results: full-run/<chunk>.txt (console) and full-run/<chunk>.json (machine-readable); summary in full-run/summary.txt
cd "$(dirname "$0")/.."
W="${1:-2}"; shift || true
CHUNKS="${*:-login core-ui1 core-ui2 core-crud core-rest supplier agent consistency contracts package quotes reservation crm insights portal-cms}"

# chunk -> "project|file filters" (filters are Playwright path regexes, empty = whole project)
files_for() {
  case "$1" in
    core-ui1)  echo "core|accounts-ui application-ui organization-ui" ;;
    core-ui2)  echo "core|product-ui region-ui resource-ui" ;;
    core-crud) echo "core|product-crud.spec region-crud.spec" ;;
    core-rest) echo "core|more-crud.spec business-rules.spec country.spec readonly- special-screens bug-evidence.spec cleanup.spec" ;;
    *)         echo "$1|" ;;
  esac
}

mkdir -p full-run
: > full-run/summary.txt
for c in $CHUNKS; do
  spec=$(files_for "$c"); p="${spec%%|*}"; f="${spec#*|}"
  start=$(date +%H:%M)
  if [ "$p" != "login" ]; then
    PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-fork npx playwright test --project=setup --output=test-results-fork-setup --reporter=line > "full-run/setup-$c.txt" 2>&1
  fi
  # shellcheck disable=SC2086
  PLAYWRIGHT_JSON_OUTPUT_NAME="full-run/$c.json" PLAYWRIGHT_HTML_OUTPUT_DIR="playwright-report-fork" \
    npx playwright test $f --project="$p" --no-deps --workers="$W" --output="test-results-fork-$c" --reporter=line,json > "full-run/$c.txt" 2>&1
  res=$(grep -aE "^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)" "full-run/$c.txt" | tr -s ' ' | tr '\n' ' ')
  echo "$c [$start-$(date +%H:%M)] $res" | tee -a full-run/summary.txt
done
echo "ALL DONE $(date +%H:%M)" >> full-run/summary.txt
