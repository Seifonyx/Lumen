#!/usr/bin/env bash
# Private iPhone QA in GitHub Codespaces: builds and serves the synthetic review on 127.0.0.1:4173.
# Run automatically when the editor attaches (.devcontainer/devcontainer.json → postAttachCommand) and safe to
# run again by hand:  bash scripts/qa/codespace-start.sh
# Every step is logged with a time to /tmp/lumen-qa.log; any failure prints FAILED and the reason, and the
# server never starts on a dirty tree, outside a Codespace, or with an unverified build.
set -u
PORT=4173
OUT=/tmp/lumen-qa-build
LOG=/tmp/lumen-qa.log
cd "$(dirname "$0")/../.." || exit 1

say() { printf '[%s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$LOG"; }
fail() { say "FAILED: $*"; say "Fix the cause above, then run: bash scripts/qa/codespace-start.sh"; exit 1; }
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }

say "Lumen private QA start (port $PORT)."
[ "${CODESPACES:-}" = "true" ] || fail "not running inside a GitHub Codespace."

if listening; then
  say "Already running. Review link:"
  grep -o 'https://[^ ]*-'"$PORT"'\.[^ ]*' "$LOG" | tail -1 | tee -a "$LOG"
  exit 0
fi

if [ ! -x node_modules/.bin/vite ]; then
  say "Installing packages (npm ci)…"
  npm ci --no-audit --no-fund >>"$LOG" 2>&1 || fail "npm ci did not complete (see $LOG)."
fi

if [ -n "$(git status --porcelain)" ]; then
  git status --short | tee -a "$LOG"
  fail "the checkout has uncommitted changes; a review build must match one exact commit."
fi

say "Building the synthetic review for commit $(git rev-parse --short HEAD) (1–3 minutes)…"
node scripts/qa/build.mjs --out "$OUT" --hours 8 2>&1 | tee -a "$LOG"
[ "${PIPESTATUS[0]}" -eq 0 ] || fail "the review build or its isolation audit failed (see above)."

say "Starting the review server. Keep this terminal open; closing it stops the review."
say "Before opening the link, check the Ports tab: port $PORT must show Private."
node scripts/qa/serve-codespace.mjs --build "$OUT" --port "$PORT" 2>&1 | tee -a "$LOG"
fail "the review server stopped (exit ${PIPESTATUS[0]})."
