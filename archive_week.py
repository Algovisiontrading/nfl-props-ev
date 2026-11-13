#!/usr/bin/env python3
"""Archive data/props_ev.json into data/weeks/<season>-wk<NN>.json and refresh index.json.
Idempotent. No-op if props_ev.json is missing or lacks season/week.
"""
import json
import sys
from pathlib import Path

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
    weeks_dir = site / "data" / "weeks"
    weeks_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{int(season)}-wk{int(week):02d}.json"
    dest = weeks_dir / fname
    dest.write_bytes(src.read_bytes())
    man_path = weeks_dir / "index.json"
    man = {}
    if man_path.exists():
        try:
            man = json.loads(man_path.read_text()) or {}
        except Exception:
            man = {}
    man["current_season"] = int(season)
    man["current_week"] = int(week)
    man["generated_at"] = data.get("generated_at") or man.get("generated_at")
    prev = [
        w
        for w in (man.get("weeks") or [])
        if not (int(w.get("season") or -1) == int(season) and int(w.get("week") or -1) == int(week))
    ]
    rows = data.get("rows") or []
    gids = {r.get("game_id") or r.get("game") or r.get("matchup") for r in rows}
    prev.append(
        {
            "season": int(season),
            "week": int(week),
            "file": fname,
            "generated_at": data.get("generated_at"),
            "rows": len(rows),
            "games": len([g for g in gids if g]),
            "sample": bool(data.get("sample")),
        }
    )
    prev.sort(key=lambda w: (int(w.get("season") or 0), int(w.get("week") or 0)), reverse=True)
    man["weeks"] = prev
    man_path.write_text(json.dumps(man, indent=2) + "\n")
    print(f"archived {dest} ({len(rows)} rows, {prev[0]['games']} games); manifest weeks={len(prev)}")
    return 0

if __name__ == "__main__":
    site = Path(__file__).resolve().parent
    sys.exit(main(site))
