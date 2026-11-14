#!/usr/bin/env python3
"""Fail publish if out/game_win_probs.json exists but winners.json dropped model lines."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(__file__).resolve().parent
MODEL = ROOT / "out" / "game_win_probs.json"


def main() -> int:
    if not MODEL.is_file():
        print("verify_winners: no out/game_win_probs.json; skipped")
        return 0
    model = json.loads(MODEL.read_text())
    mgames = model.get("games") or []
    if isinstance(mgames, dict):
        model_ids = set(mgames.keys())
    else:
        model_ids = {str(g.get("game_id")) for g in mgames if g.get("game_id")}
    season = model.get("season")
    week = model.get("week")
    winners_path = None
    if season is not None and week is not None:
        winners_path = SITE / "data" / "weeks" / f"{int(season)}-wk{int(week):02d}" / "winners.json"
    if winners_path is None or not winners_path.is_file():
        # fall back to any winners.json
        cands = list((SITE / "data" / "weeks").glob("*/winners.json"))
        winners_path = cands[0] if cands else None
    if not winners_path or not winners_path.is_file():
        print("verify_winners: ERROR game_win_probs.json is present but winners.json was not written", file=sys.stderr)
        return 1
    data = json.loads(winners_path.read_text())
    games = data.get("games") or []
    if isinstance(games, dict):
        games = list(games.values())
    have = sum(1 for g in games if g.get("model_winner"))
    total = len(games)
    missing = []
    for g in games:
        gid = str(g.get("game_id") or "")
        if gid in model_ids and not g.get("model_winner"):
            missing.append(gid)
    # also games in the model file not present at all
    present_ids = {str(g.get("game_id") or "") for g in games}
    absent = sorted(model_ids - present_ids)
    print(f"verify_winners: {have}/{total} games have model_winner in {winners_path.relative_to(SITE)}")
    if missing or absent or have < len(model_ids):
        print(f"verify_winners: ERROR expected model lines for {len(model_ids)} games from game_win_probs.json; missing={missing} absent={absent}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
