#!/usr/bin/env python3
"""Write data/paper_bets/index.json from any summary_*.json already copied there."""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

DEST = Path(__file__).resolve().parent / "data" / "paper_bets"
WEEK_RE = re.compile(r"^summary_(\d{4})_wk(\d{1,2})\.json$", re.I)
SEASON_RE = re.compile(r"^summary_(\d{4})(?:_total|_season|_ytd)?\.json$", re.I)

def kind_for(name, data):
    meta = {"file": name}
    m = WEEK_RE.match(name)
    if m:
        meta["kind"] = "week"
        meta["season"] = int(m.group(1))
        meta["week"] = int(m.group(2))
        return meta
    m = SEASON_RE.match(name)
    if m:
        meta["kind"] = "season"
        meta["season"] = int(m.group(1))
        return meta
    meta["kind"] = "other"
    if isinstance(data, dict):
        if data.get("week") is not None:
            try:
                meta["week"] = int(data["week"])
                meta["kind"] = "week"
            except (TypeError, ValueError):
                pass
        if data.get("season") is not None:
            try:
                meta["season"] = int(data["season"])
            except (TypeError, ValueError):
                pass
    return meta

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    files = []
    for path in sorted(DEST.glob("summary_*.json")):
        try:
            data = json.loads(path.read_text())
        except Exception:
            data = {}
        meta = kind_for(path.name, data if isinstance(data, dict) else {})
        if isinstance(data, dict):
            if meta.get("season") is None and data.get("season") is not None:
                meta["season"] = data["season"]
            if meta.get("week") is None and data.get("week") is not None:
                meta["week"] = data["week"]
                meta["kind"] = "week"
        files.append(meta)
    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": files,
    }
    (DEST / "index.json").write_text(json.dumps(payload, indent=2) + "\n")
    print(f"build_paper_bets_index: {len(files)} file(s)")

if __name__ == "__main__":
    main()
