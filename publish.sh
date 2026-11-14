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
if ! copy_if_present "$ROOT/out/graded_picks.json" "$SITE/data/graded_picks.json"; then
  copy_if_present "$ROOT/models/graded_picks.json" "$SITE/data/graded_picks.json" || true
fi
copy_if_present "$ROOT/models/moneyline_roi_backtest_results.json" "$SITE/data/moneyline_backtest.json" || true

# Kalshi 2026 weeks 1–9 out-of-sample backtest (official results file).
copy_if_present "$ROOT/models/kalshi_backtest_2026_results.json" "$SITE/data/kalshi_backtest_2026.json" || true

# Legacy optional Kalshi file name (kept for compatibility; the page does not render it).
kalshi_src=""
for cand in \
  "$ROOT/out/kalshi_props_backtest.json" \
  "$ROOT/out/kalshi_props_backtest_results.json" \
  "$ROOT/models/kalshi_props_backtest.json" \
  "$ROOT/models/kalshi_props_backtest_results.json"
do
  if [[ -f "$cand" ]]; then
    kalshi_src="$cand"
    break
  fi
done
if [[ -n "$kalshi_src" ]]; then
  copy_if_present "$kalshi_src" "$SITE/data/kalshi_props_backtest.json" || true
fi

# Projection accuracy (CSV now; JSON if/when Modeler publishes one).
if ! copy_if_present "$ROOT/models/projection_accuracy.json" "$SITE/data/projection_accuracy.json"; then
  copy_if_present "$ROOT/out/projection_accuracy.json" "$SITE/data/projection_accuracy.json" || true
fi
if ! copy_if_present "$ROOT/models/projection_accuracy_test.csv" "$SITE/data/projection_accuracy.csv"; then
  copy_if_present "$ROOT/models/projection_accuracy.csv" "$SITE/data/projection_accuracy.csv" || true
fi

# Paper-bet weekly/season summaries (skip gracefully if none).
paper_src="$ROOT/out/paper_bets"
paper_dest="$SITE/data/paper_bets"
mkdir -p "$paper_dest"
shopt -s nullglob
if [[ -d "$paper_src" ]]; then
  for src in "$paper_src"/summary_*.json; do
    copy_if_present "$src" "$paper_dest/$(basename "$src")" || true
  done
fi
shopt -u nullglob
python3 "$SITE/build_paper_bets_index.py" || true

# Player projections (JSON preferred, CSV fallback). Also writes the week copy.
python3 "$SITE/build_projections.py" || true

# Official parlays only (never out/candidates/).
python3 "$SITE/build_parlays.py" || true

# Archive this week's file automatically (keeps prior weeks in the manifest).
python3 "$SITE/archive_week.py"

python3 "$SITE/verify_winners.py" || exit 1


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
  ml_code="skip"
  if [[ -f "$SITE/data/moneyline_backtest.json" ]]; then
    ml_code="$(curl -sS -o /tmp/nfl-props-ml-backtest.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/moneyline_backtest.json" || echo "000")"
  fi
  kalshi_code="skip"
  if [[ -f "$SITE/data/kalshi_backtest_2026.json" ]]; then
    kalshi_code="$(curl -sS -o /tmp/nfl-props-kalshi-backtest.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/kalshi_backtest_2026.json" || echo "000")"
  elif [[ -f "$SITE/data/kalshi_props_backtest.json" ]]; then
    kalshi_code="$(curl -sS -o /tmp/nfl-props-kalshi-backtest.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/kalshi_props_backtest.json" || echo "000")"
  fi
  weeks_code="$(curl -sS -o /tmp/nfl-props-weeks.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/weeks/index.json" || echo "000")"
  top_code="$(curl -sS -o /tmp/nfl-props-top.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/props_top.json" || echo "000")"
  game_code="$(curl -sS -o /tmp/nfl-props-game.html -w '%{http_code}' --max-time 20 "$LIVE_BASE/game.html" || echo "000")"
  proj_page="skip"
  if [[ -f "$SITE/projections.html" ]]; then
    proj_page="$(curl -sS -o /tmp/nfl-props-projections.html -w '%{http_code}' --max-time 20 "$LIVE_BASE/projections.html" || echo "000")"
  fi
  proj_data="skip"
  if [[ -f "$SITE/data/projections.json" ]]; then
    proj_data="$(curl -sS -o /tmp/nfl-props-projections.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/projections.json" || echo "000")"
  fi
  acc_code="skip"
  if [[ -f "$SITE/data/projection_accuracy.json" ]]; then
    acc_code="$(curl -sS -o /tmp/nfl-props-proj-acc.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/projection_accuracy.json" || echo "000")"
  elif [[ -f "$SITE/data/projection_accuracy.csv" ]]; then
    acc_code="$(curl -sS -o /tmp/nfl-props-proj-acc.csv -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/projection_accuracy.csv" || echo "000")"
  fi
  paper_code="skip"
  if [[ -f "$SITE/data/paper_bets/index.json" ]]; then
    paper_code="$(curl -sS -o /tmp/nfl-props-paper-index.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/paper_bets/index.json" || echo "000")"
  fi
  parlays_code="skip"
  if [[ -f "$SITE/data/parlays.json" ]]; then
    parlays_code="$(curl -sS -o /tmp/nfl-props-parlays.json -w '%{http_code}' --max-time 20 "$LIVE_BASE/data/parlays.json" || echo "000")"
  fi
  last_info="index=$idx_code track=$tr_code data=$json_code graded=$graded_code weeks=$weeks_code top=$top_code game=$game_code ml=$ml_code kalshi=$kalshi_code proj=$proj_page projdata=$proj_data acc=$acc_code paper=$paper_code parlays=$parlays_code"
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
  if [[ "$idx_code" == "200" && "$tr_code" == "200" && "$json_code" == "200" && ( "$graded_code" == "skip" || "$graded_code" == "200" ) && "$weeks_code" == "200" && "$top_code" == "200" && "$game_code" == "200" && ( "$ml_code" == "skip" || "$ml_code" == "200" ) && ( "$kalshi_code" == "skip" || "$kalshi_code" == "200" ) && ( "$proj_page" == "skip" || "$proj_page" == "200" ) && ( "$proj_data" == "skip" || "$proj_data" == "200" ) && ( "$acc_code" == "skip" || "$acc_code" == "200" ) && ( "$paper_code" == "skip" || "$paper_code" == "200" ) && ( "$parlays_code" == "skip" || "$parlays_code" == "200" ) ]]; then
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
