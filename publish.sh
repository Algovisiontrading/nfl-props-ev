#!/usr/bin/env bash
# Publish the static dashboard to GitHub Pages (Algovisiontrading/nfl-props-ev).
# Copies model outputs into site/data/ when present, commits, pushes, waits for
# the live URL, and appends a dated line to ../STATUS.md.
# Idempotent: exits 0 with "no changes" when the tree is clean after copies.
set -euo pipefail

SITE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SITE/.." && pwd)"
STATUS="$ROOT/STATUS.md"
LIVE_BASE="${LIVE_BASE:-https://algovisiontrading.github.io/nfl-props-ev}"
REPO_SLUG="${REPO_SLUG:-Algovisiontrading/nfl-props-ev}"
BRANCH="${BRANCH:-main}"
TIMEOUT_SECS="${TIMEOUT_SECS:-240}"

ts_et() { TZ=America/New_York date '+%Y-%m-%d %H:%M ET'; }

append_status() {
  mkdir -p "$(dirname "$STATUS")"
  touch "$STATUS"
  printf '%s\n' "[$(ts_et)] [Props Site] $1" >> "$STATUS"
}

log() { printf '%s\n' "$*"; }

copy_if_present() {
  local src="$1" dest="$2"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    log "copied $src -> $dest"
    return 0
  fi
  return 1
}

cd "$SITE"
mkdir -p "$SITE/data"

copy_if_present "$ROOT/out/props_ev.json" "$SITE/data/props_ev.json" || true
copy_if_present "$ROOT/models/track_record.json" "$SITE/data/track_record.json" || true
copy_if_present "$ROOT/models/graded_picks.json" "$SITE/data/graded_picks.json" || true

if [[ ! -d "$SITE/.git" ]]; then
  log "error: $SITE is not a git repository; initialize it and add the $REPO_SLUG remote first."
  append_status "publish failed: site/ is not a git repo"
  exit 1
fi

git add -A
if git diff --cached --quiet && [[ -z "$(git status --porcelain)" ]]; then
  log "no changes"
  append_status "no changes; live ${LIVE_BASE}/"
  exit 0
fi

# If the only dirty state was already staged identically, the cached check is enough.
if git diff --cached --quiet; then
  log "no changes"
  append_status "no changes; live ${LIVE_BASE}/"
  exit 0
fi

generated_at="$(python3 - <<'PY'
import json, os
p = os.environ.get("PROPS_JSON", "data/props_ev.json")
try:
    with open(p) as f:
        data = json.load(f)
    if isinstance(data, dict):
        print(data.get("generated_at") or data.get("updated_at") or "")
    else:
        print("")
except Exception:
    print("")
PY
)"

msg="Publish props dashboard $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ -n "$generated_at" ]]; then
  msg="$msg (generated_at=$generated_at)"
fi
git commit -m "$msg"
git push -u origin "$BRANCH"

# Enable GitHub Pages from main branch root if not already on.
if gh api "repos/${REPO_SLUG}/pages" >/dev/null 2>&1; then
  log "GitHub Pages already enabled"
else
  log "enabling GitHub Pages (main branch, /)"
  gh api -X POST "repos/${REPO_SLUG}/pages" --input - <<JSON
{"source":{"branch":"${BRANCH}","path":"/"}}
JSON
fi


# Wait until the live site serves 200 and (when known) the new generated_at.
deadline=$(( $(date +%s) + TIMEOUT_SECS ))
ok=0
last_info=""
while (( $(date +%s) < deadline )); do
  idx_code="$(curl -sS -o /tmp/nfl-props-index.html -w '%{http_code}' --max-time 20 "$LIVE_BASE/" || echo "000")"
  tr_code="$(curl -sS -o /tmp/nfl-props-track.html -w '%{http_code}' --max-time 20 "$LIVE_BASE/track-record.html" || echo "000")"
  json_code="$(curl -sS -o /tmp/nfl-props-live.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/props_ev.json" || echo "000")"
  graded_code="skip"
  if [[ -f "$SITE/data/graded_picks.json" ]]; then
    graded_code="$(curl -sS -o /tmp/nfl-props-graded.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/graded_picks.json" || echo "000")"
  fi
  last_info="index=$idx_code track=$tr_code data=$json_code graded=$graded_code"
  live_gen=""
  if [[ "$json_code" == "200" ]]; then
    live_gen="$(python3 - <<'PY'
import json
try:
    with open("/tmp/nfl-props-live.json") as f:
        data = json.load(f)
    if isinstance(data, dict):
        print(data.get("generated_at") or data.get("updated_at") or "")
    else:
        print("")
except Exception:
    print("")
PY
)"
    last_info="$last_info generated_at=$live_gen"
  fi
  if [[ "$idx_code" == "200" && "$tr_code" == "200" && "$json_code" == "200" && ( "$graded_code" == "skip" || "$graded_code" == "200" ) ]]; then
    if [[ -z "$generated_at" || "$live_gen" == "$generated_at" ]]; then
      ok=1
      break
    fi
  fi
  sleep 10
done

if [[ "$ok" -ne 1 ]]; then
  log "warning: timed out waiting for live site ($last_info); pushed anyway"
  append_status "pushed ${REPO_SLUG} but live check timed out ($last_info). URL ${LIVE_BASE}/"
  exit 1
fi

log "live ok $last_info"
append_status "published ${LIVE_BASE}/ (repo https://github.com/${REPO_SLUG}; $last_info)"
exit 0
