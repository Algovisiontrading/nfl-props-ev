#!/usr/bin/env python3
"""Copy or convert the latest player-projection file into the site.

Prefers a JSON file in out/ (projections.json, projections_week.json, or
projections*.json). If none exists, converts out/projections_week.csv (or
another out/projections*.csv). Writes a slim data/projections.json and, when
season/week are known, data/weeks/<season>-wk<NN>/projections.json.
Missing sources are skipped with no error.
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(__file__).resolve().parent
OUT = ROOT / "out"

KEEP = (
    "season", "week", "game_id", "kickoff", "matchup", "game",
    "player", "player_id", "position", "team", "opponent",
    "market", "model", "model_mean", "mean", "proj_mean",
    "proj_median", "median", "model_median",
    "proj_p25", "p25", "model_p25", "q25",
    "proj_p75", "p75", "model_p75", "q75",
    "sample_size", "typical_line", "drivers", "role_adj",
    "market_passed", "check", "promoted_by_absence", "role_flags",
    "line", "model_name", "dist",
)

NUM_KEYS = {
    "season", "week", "model_mean", "mean", "proj_mean",
    "proj_median", "median", "model_median",
    "proj_p25", "p25", "model_p25", "q25",
    "proj_p75", "p75", "model_p75", "q75",
    "sample_size", "typical_line",
}


def _num(v):
    if v is None or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return n


def slim_row(raw: dict) -> dict | None:
    if not raw:
        return None
    out = {}
    for k in KEEP:
        if k in raw and raw[k] not in (None, ""):
            out[k] = _num(raw[k]) if k in NUM_KEYS else raw[k]
    # Canonical projection fields
    mean = _num(out.get("model_mean") or out.get("mean") or out.get("proj_mean") or raw.get("model_mean") or raw.get("mean"))
    if mean is not None:
        out["model_mean"] = mean
    med = _num(out.get("proj_median") or out.get("median") or out.get("model_median") or raw.get("proj_median"))
    if med is not None:
        out["proj_median"] = med
    p25 = _num(out.get("proj_p25") or out.get("p25") or out.get("model_p25") or out.get("q25") or raw.get("proj_p25"))
    if p25 is not None:
        out["proj_p25"] = p25
    p75 = _num(out.get("proj_p75") or out.get("p75") or out.get("model_p75") or out.get("q75") or raw.get("proj_p75"))
    if p75 is not None:
        out["proj_p75"] = p75
    if "game" not in out and out.get("matchup"):
        out["game"] = out["matchup"]
    if not out.get("player") or not out.get("market"):
        return None
    # Drop alias keys that we already canonicalized
    for alias in ("mean", "proj_mean", "median", "model_median", "p25", "model_p25", "q25", "p75", "model_p75", "q75"):
        out.pop(alias, None)
    return out


def find_source() -> Path | None:
    preferred_json = [
        OUT / "projections.json",
        OUT / "projections_full.json",
        OUT / "projections_week.json",
    ]
    for p in preferred_json:
        if p.is_file():
            return p
    extras = sorted(OUT.glob("projections*.json"))
    if extras:
        return extras[0]
    preferred_csv = [
        OUT / "projections_week.csv",
        OUT / "projections.csv",
    ]
    for p in preferred_csv:
        if p.is_file():
            return p
    extras = sorted(OUT.glob("projections*.csv"))
    return extras[0] if extras else None


def load_rows(path: Path) -> tuple[list, dict]:
    meta = {"source": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path)}
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text())
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = data.get("rows") or data.get("projections") or data.get("data") or []
            for k in ("generated_at", "updated_at", "generated_at_utc", "season", "week", "sample", "note", "markets"):
                if data.get(k) is not None:
                    meta[k] = data[k]
        else:
            rows = []
        return [r for r in (slim_row(x) for x in rows) if r], meta
    # CSV
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        rows = [r for r in (slim_row(x) for x in reader) if r]
    return rows, meta


def infer_season_week(rows, meta):
    season = meta.get("season")
    week = meta.get("week")
    if season is None or week is None:
        for r in rows:
            if season is None and r.get("season") is not None:
                try:
                    season = int(r["season"])
                except (TypeError, ValueError):
                    season = r["season"]
            if week is None and r.get("week") is not None:
                try:
                    week = int(r["week"])
                except (TypeError, ValueError):
                    week = r["week"]
            if season is not None and week is not None:
                break
    return season, week


def dump(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def main() -> int:
    src = find_source()
    if not src:
        print("build_projections: no source file in out/; skipped")
        return 0
    rows, meta = load_rows(src)
    season, week = infer_season_week(rows, meta)
    payload = {
        "generated_at": meta.get("generated_at") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": meta.get("source"),
        "season": season,
        "week": week,
        "rows": rows,
    }
    if meta.get("sample"):
        payload["sample"] = True
    if meta.get("note"):
        payload["note"] = meta["note"]
    if meta.get("markets"):
        payload["markets"] = meta["markets"]
    dest = SITE / "data" / "projections.json"
    dump(dest, payload)
    week_path = None
    if season is not None and week is not None:
        try:
            stem = f"{int(season)}-wk{int(week):02d}"
            week_path = SITE / "data" / "weeks" / stem / "projections.json"
            dump(week_path, payload)
        except (TypeError, ValueError):
            week_path = None
    extra = f"; week copy {week_path}" if week_path else ""
    print(f"build_projections: {src} -> {dest} ({len(rows)} rows, season={season} week={week}){extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
