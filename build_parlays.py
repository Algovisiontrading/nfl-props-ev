#!/usr/bin/env python3
"""Copy out/parlays.json into the site when present. Never copies out/candidates/."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(__file__).resolve().parent
SRC = ROOT / "out" / "parlays.json"


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def main() -> int:
    if not SRC.is_file():
        print("build_parlays: out/parlays.json missing; skipped (no draft/candidates copy)")
        return 0
    data = json.loads(SRC.read_text())
    dest = SITE / "data" / "parlays.json"
    dump(dest, data)
    season = week = None
    if isinstance(data, dict):
        season = data.get("season")
        week = data.get("week")
    if season is not None and week is not None:
        try:
            stem = f"{int(season)}-wk{int(week):02d}"
            dump(SITE / "data" / "weeks" / stem / "parlays.json", data)
            print(f"build_parlays: {SRC} -> {dest} and weeks/{stem}/parlays.json")
        except (TypeError, ValueError):
            print(f"build_parlays: {SRC} -> {dest}")
    else:
        print(f"build_parlays: {SRC} -> {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
