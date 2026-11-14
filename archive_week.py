#!/usr/bin/env python3
"""Archive the current props file and write slim board/game payloads.

Copies data/props_ev.json to data/weeks/<season>-wk<NN>.json (full file, kept
for compatibility), writes slim:
  data/props_top.json
  data/weeks/<season>-wk<NN>/top.json
  data/weeks/<season>-wk<NN>/all.json
  data/weeks/<season>-wk<NN>/games/<game_id>.json
and refreshes data/weeks/index.json.

Idempotent. No-op if props_ev.json is missing or lacks season/week.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

MARKET_ALIASES = {
    "completions": "pass_completions",
    "pass_completion": "pass_completions",
    "interceptions": "pass_ints",
    "interception": "pass_ints",
    "ints": "pass_ints",
    "int": "pass_ints",
    "carries": "rush_attempts",
    "carry": "rush_attempts",
}

SLIM_FIELDS = (
    "player",
    "player_id",
    "position",
    "team",
    "opponent",
    "game_id",
    "game",
    "matchup",
    "kickoff",
    "market",
    "side",
    "line",
    "odds_american",
    "odds",
    "book",
    "model_prob",
    "fair_odds_american",
    "implied_prob_novig",
    "edge_pct",
    "ev_per_100",
    "kelly_stake_pct",
    "drivers",
    "reason",
    "summary",
    "tier",
    "confidence",
    "sample_size",
    "model_passed",
    "passed",
    "volume",
    "kalshi_volume",
    "kalshi_open_interest",
    "open_interest",
    "oi",
    "kalshi_bid",
    "bid",
    "kalshi_ask",
    "ask",
    "kalshi_spread_cents",
    "spread_cents",
    "flag",
    "flags",
    "check",
    "roof",
    "wind_mph",
    "temp_f",
    "precip_pct",
    "coaching_flag",
    "updated_at",
)

CHECK_EDGE = 15
THIN_SPREAD = 5
STRONG_MIN_EV = 5
STRONG_MIN_EDGE = 4
LEAN_MIN_EV = 0
LEAN_MIN_EDGE = 2


def num(v):
    if v is None or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return n


def pick(row, keys):
    for k in keys:
        if row.get(k) is not None and row.get(k) != "":
            return row[k]
    return None


def canonical_market(m):
    if m is None or m == "":
        return ""
    key = re.sub(r"[\s-]+", "_", str(m).strip().lower())
    return MARKET_ALIASES.get(key, key)


def normalize_tier_name(v):
    if v is None or v == "":
        return None
    low = str(v).strip().lower()
    if low == "strong":
        return "Strong"
    if low == "lean":
        return "Lean"
    if low == "pass":
        return "Pass"
    return str(v).strip()


def is_failed(row):
    v = row.get("model_passed")
    if v is None:
        v = row.get("passed")
    return v is False or v == "false" or v == 0 or v == "0"


def fallback_tier(ev, edge, confidence):
    conf = str(confidence or "").lower()
    if ev is not None and edge is not None and ev >= STRONG_MIN_EV and edge >= STRONG_MIN_EDGE and conf != "low":
        return "Strong"
    if ev is not None and edge is not None and ev > LEAN_MIN_EV and edge >= LEAN_MIN_EDGE:
        return "Lean"
    return "Pass"


def parse_supplied_flags(row):
    check = False
    thin = False

    def eat(v):
        nonlocal check, thin
        if v is None or v == "":
            return
        if isinstance(v, list):
            for x in v:
                eat(x)
            return
        if v is True or v == 1:
            check = True
            return
        s = re.sub(r"[_-]+", " ", str(v).strip().lower())
        if not s or s in ("false", "0", "none", "pass"):
            return
        if s in ("true", "check", "flag") or "check" in s:
            check = True
        elif "thin" in s:
            thin = True

    eat(row.get("flag"))
    eat(row.get("flags"))
    eat(row.get("check"))
    return check, thin


def kalshi_spread_cents(row):
    spr = num(pick(row, ("kalshi_spread_cents", "spread_cents")))
    if spr is not None:
        return spr
    ask = num(pick(row, ("kalshi_ask", "ask")))
    bid = num(pick(row, ("kalshi_bid", "bid")))
    if ask is None or bid is None:
        return None
    diff = ask - bid
    if abs(ask) <= 1 and abs(bid) <= 1:
        return diff * 100
    return diff


def has_listed_liquidity(row):
    vol = num(pick(row, ("volume", "kalshi_volume")))
    oi = num(pick(row, ("kalshi_open_interest", "open_interest", "oi")))
    return (vol is not None and vol > 0) or (oi is not None and oi > 0)


def apply_tier_and_guards(row):
    """Return (display_tier or None if failed, badges). Mirrors js/common.js."""
    if is_failed(row):
        return None, []
    ev = num(pick(row, ("ev_per_100", "ev")))
    edge = num(pick(row, ("edge_pct", "edge")))
    supplied = normalize_tier_name(row.get("tier"))
    tier = supplied or fallback_tier(ev, edge, row.get("confidence"))
    badges = []
    supplied_check, supplied_thin = parse_supplied_flags(row)
    check = (edge is not None and edge > CHECK_EDGE) or supplied_check
    thin = supplied_thin
    book = str(pick(row, ("book",)) or "")
    if "kalshi" in book.lower():
        spread = kalshi_spread_cents(row)
        if (not has_listed_liquidity(row)) or (spread is not None and spread > THIN_SPREAD):
            thin = True
    if thin:
        badges.append("Thin market")
        if tier in ("Strong", "Lean"):
            tier = "Pass"
    if check:
        badges.append("Check")
        if tier == "Strong":
            tier = "Lean"
        if thin:
            tier = "Pass"
    return tier, badges


def slim_row(row):
    out = {}
    for k in SLIM_FIELDS:
        if k in row and row[k] is not None:
            out[k] = row[k]
    market = canonical_market(out.get("market") or row.get("market") or "")
    if market:
        out["market"] = market
    return out


def dump_compact(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def week_stem(season, week) -> str:
    return f"{int(season)}-wk{int(week):02d}"


def build_games_summary(rows):
    games = {}
    order = []
    for r in rows:
        tier, _badges = apply_tier_and_guards(r)
        if tier is None:
            continue
        gid = r.get("game_id") or r.get("matchup") or r.get("game") or ""
        if not gid:
            continue
        if gid not in games:
            games[gid] = {
                "game_id": r.get("game_id") or gid,
                "matchup": r.get("matchup") or r.get("game") or gid,
                "kickoff": r.get("kickoff"),
                "picks": 0,
                "strong": 0,
                "lean": 0,
            }
            order.append(gid)
        g = games[gid]
        g["picks"] += 1
        if tier == "Strong":
            g["strong"] += 1
        elif tier == "Lean":
            g["lean"] += 1
        ko = r.get("kickoff")
        if ko and (not g.get("kickoff") or str(ko) < str(g["kickoff"])):
            g["kickoff"] = ko
    out = [games[i] for i in order]
    out.sort(key=lambda g: (g.get("kickoff") or "", g.get("matchup") or ""))
    return out


def write_slim(site: Path, data: dict, season: int, week: int) -> dict:
    rows = data.get("rows") or []
    stem = week_stem(season, week)
    week_dir = site / "data" / "weeks" / stem
    games_dir = week_dir / "games"
    if games_dir.exists():
        shutil.rmtree(games_dir)
    games_dir.mkdir(parents=True, exist_ok=True)

    slim_all = [slim_row(r) for r in rows]
    top_rows = []
    for raw, slim in zip(rows, slim_all):
        tier, _ = apply_tier_and_guards(raw)
        if tier in ("Strong", "Lean"):
            top_rows.append(slim)

    games = build_games_summary(rows)
    meta = {
        "generated_at": data.get("generated_at"),
        "updated_at": data.get("updated_at") or data.get("generated_at"),
        "season": int(season),
        "week": int(week),
        "sample": bool(data.get("sample")),
        "slim": True,
    }
    if data.get("note"):
        meta["note"] = data["note"]

    all_payload = dict(meta)
    all_payload["rows"] = slim_all
    dump_compact(week_dir / "all.json", all_payload)

    by_game = defaultdict(list)
    for slim in slim_all:
        gid = slim.get("game_id") or slim.get("matchup") or slim.get("game")
        if gid:
            by_game[str(gid)].append(slim)
    for gid, grows in by_game.items():
        safe = Path(gid).name  # prevent path traversal
        gp = dict(meta)
        gp["game_id"] = gid
        if grows:
            gp["matchup"] = grows[0].get("matchup") or grows[0].get("game")
            gp["kickoff"] = grows[0].get("kickoff")
        gp["rows"] = grows
        dump_compact(games_dir / f"{safe}.json", gp)

    top_payload = dict(meta)
    top_payload["rows"] = top_rows
    top_payload["games"] = games
    top_payload["pass_rows"] = max(0, len(rows) - len(top_rows) - sum(1 for r in rows if apply_tier_and_guards(r)[0] is None))
    # pass_rows = passing rows that are not Strong/Lean
    failed = sum(1 for r in rows if apply_tier_and_guards(r)[0] is None)
    passing = len(rows) - failed
    top_payload["pass_rows"] = passing - len(top_rows)
    top_payload["all_file"] = f"data/weeks/{stem}/all.json"
    dump_compact(week_dir / "top.json", top_payload)
    dump_compact(site / "data" / "props_top.json", top_payload)

    return {
        "top_rows": len(top_rows),
        "all_rows": len(slim_all),
        "games": len(games),
        "pass_rows": top_payload["pass_rows"],
        "stem": stem,
        "top_bytes": (week_dir / "top.json").stat().st_size,
        "all_bytes": (week_dir / "all.json").stat().st_size,
        "props_top_bytes": (site / "data" / "props_top.json").stat().st_size,
    }


def main(site: Path) -> int:
    src = site / "data" / "props_ev.json"
    if not src.exists():
        print("archive skip: no data/props_ev.json")
        return 0
    data = json.loads(src.read_text())
    season = data.get("season")
    week = data.get("week")
    if season is None or week is None:
        print("archive skip: props_ev.json has no season/week")
        return 0
    season, week = int(season), int(week)
    weeks_dir = site / "data" / "weeks"
    weeks_dir.mkdir(parents=True, exist_ok=True)
    stem = week_stem(season, week)
    full_name = f"{stem}.json"
    dest = weeks_dir / full_name
    dest.write_bytes(src.read_bytes())

    stats = write_slim(site, data, season, week)

    man_path = weeks_dir / "index.json"
    man = {}
    if man_path.exists():
        try:
            man = json.loads(man_path.read_text()) or {}
        except Exception:
            man = {}
    man["current_season"] = season
    man["current_week"] = week
    man["generated_at"] = data.get("generated_at") or man.get("generated_at")
    prev = [
        w
        for w in (man.get("weeks") or [])
        if not (int(w.get("season") or -1) == season and int(w.get("week") or -1) == week)
    ]
    prev.append(
        {
            "season": season,
            "week": week,
            "file": full_name,
            "top_file": f"{stem}/top.json",
            "all_file": f"{stem}/all.json",
            "games_dir": f"{stem}/games/",
            "generated_at": data.get("generated_at"),
            "rows": len(data.get("rows") or []),
            "top_rows": stats["top_rows"],
            "games": stats["games"],
            "sample": bool(data.get("sample")),
        }
    )
    prev.sort(key=lambda w: (int(w.get("season") or 0), int(w.get("week") or 0)), reverse=True)
    man["weeks"] = prev
    man_path.write_text(json.dumps(man, indent=2) + "\n")

    try:
        from build_winners import build as build_winners
        build_winners(site, season, week)
    except Exception as exc:
        print(f"build_winners skipped: {type(exc).__name__}: {exc}")

    print(
        f"archived {dest} ({len(data.get('rows') or [])} full rows, {stats['games']} games); "
        f"slim top={stats['top_rows']} rows ({stats['top_bytes']} bytes), "
        f"all={stats['all_rows']} ({stats['all_bytes']} bytes); manifest weeks={len(prev)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(__file__).resolve().parent))
