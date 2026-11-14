#!/usr/bin/env python3
"""Attach an "Our model" winner line only when out/game_win_probs.json exists.

Market moneylines may still be computed in unused helpers, but they are not
written to the site. If the modeler file is missing, any previously published
winners.json / winner_accuracy.json and favorite fields are removed. Publishing
still succeeds if this script exits 0 after a skip.
"""
from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

WINNER_FIELDS = (
    "likely_winner",
    "likely_winner_prob",
    "home_team",
    "away_team",
    "home_win_prob",
    "away_win_prob",
    "winner_source",
    "winner_source_label",
    "winner_tooltip",
    "winner_updated_at",
    "winner_n_books",
    "market",
    "model",
    "model_winner",
    "model_winner_prob",
    "model_source_label",
    "model_tooltip",
    "model_updated_at",
    "model_home_win_prob",
    "model_away_win_prob",
)


def log(msg: str) -> None:
    print(msg, flush=True)


def project_root(site: Path) -> Path:
    return site.resolve().parent


def ensure_pandas(root: Path) -> bool:
    try:
        import pandas  # noqa: F401
        import pyarrow  # noqa: F401

        return True
    except ImportError:
        pass
    venv = root / ".venv" / "bin" / "python"
    if venv.exists() and Path(sys.executable).resolve() != venv.resolve():
        os.execv(str(venv), [str(venv), *sys.argv])
    log("build_winners skip: pandas/pyarrow not available")
    return False


def american_to_prob(ml: Any) -> Optional[float]:
    try:
        if ml is None or (isinstance(ml, float) and math.isnan(ml)):
            return None
        ml = float(ml)
    except (TypeError, ValueError):
        return None
    if ml == 0:
        return None
    if ml < 0:
        return (-ml) / ((-ml) + 100.0)
    return 100.0 / (ml + 100.0)


def no_vig_pair(home_ml: Any, away_ml: Any) -> Optional[tuple[float, float]]:
    hp = american_to_prob(home_ml)
    ap = american_to_prob(away_ml)
    if hp is None or ap is None:
        return None
    total = hp + ap
    if total <= 0 or not math.isfinite(total):
        return None
    return hp / total, ap / total


def format_et(iso: Optional[str]) -> str:
    if not iso:
        return ""
    raw = str(iso).strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return str(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(ET)
    # Match the site's formatET: "Nov 13, 2026, 9:41 AM ET"
    hour = dt.strftime("%I").lstrip("0") or "0"
    return dt.strftime(f"%b {dt.day}, %Y, {hour}:%M %p ET")


def pct_label(prob: float) -> str:
    return str(int(round(float(prob) * 100)))


def pct1(x: float) -> str:
    return f"{float(x) * 100:.1f}%"


def en_years(lo: int, hi: Optional[int] = None, so_far: bool = False) -> str:
    if hi is None or lo == hi:
        text = str(lo)
    else:
        text = f"{lo}–{hi}"
    if so_far:
        text += " so far"
    return text


def dump_json(path: Path, obj: Any, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if pretty:
        path.write_text(json.dumps(obj, indent=2) + "\n")
    else:
        path.write_text(json.dumps(obj, separators=(",", ":")) + "\n")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def week_games(site: Path, season: int, week: int) -> list[dict]:
    """Known games this week, from slim top file or the full week JSON."""
    stem = f"{season}-wk{week:02d}"
    for path in (
        site / "data" / "weeks" / stem / "top.json",
        site / "data" / "props_top.json",
        site / "data" / "weeks" / f"{stem}.json",
        site / "data" / "props_ev.json",
    ):
        if not path.exists():
            continue
        try:
            raw = load_json(path)
        except Exception:
            continue
        if not isinstance(raw, dict):
            continue
        if raw.get("season") is not None and int(raw["season"]) != int(season):
            continue
        if raw.get("week") is not None and int(raw["week"]) != int(week):
            continue
        if raw.get("games"):
            return list(raw["games"])
        seen = {}
        order = []
        for r in raw.get("rows") or []:
            gid = r.get("game_id") or r.get("matchup") or r.get("game")
            if not gid or gid in seen:
                continue
            seen[gid] = {
                "game_id": r.get("game_id") or gid,
                "matchup": r.get("matchup") or r.get("game") or gid,
                "kickoff": r.get("kickoff"),
                "home_team": r.get("opponent") if False else r.get("home_team"),
                "away_team": r.get("away_team"),
            }
            # infer home/away from matchup "NE @ DET"
            mu = seen[gid]["matchup"] or ""
            if "@" in mu and not seen[gid].get("away_team"):
                parts = [p.strip() for p in mu.split("@", 1)]
                if len(parts) == 2:
                    seen[gid]["away_team"] = parts[0]
                    seen[gid]["home_team"] = parts[1]
            order.append(gid)
        if order:
            return [seen[g] for g in order]
    return []


def teams_from_game(g: dict) -> tuple[Optional[str], Optional[str]]:
    away, home = g.get("away_team"), g.get("home_team")
    if away and home:
        return str(away), str(home)
    mu = g.get("matchup") or g.get("game") or ""
    if "@" in mu:
        parts = [p.strip() for p in str(mu).split("@", 1)]
        if len(parts) == 2:
            return parts[0], parts[1]
    gid = str(g.get("game_id") or "")
    bits = gid.split("_")
    if len(bits) >= 4:
        return bits[2], bits[3]
    return away, home


def parse_model_file(path: Path) -> Optional[dict]:
    try:
        raw = load_json(path)
    except Exception as exc:
        log(f"build_winners: could not read {path}: {exc}")
        return None
    if not isinstance(raw, dict):
        log(f"build_winners: {path} is not an object; ignoring")
        return None
    games: dict[str, dict] = {}
    blob = raw.get("games") or raw.get("rows") or raw.get("results") or raw
    if isinstance(blob, dict):
        items = blob.items()
        for gid, rec in items:
            if gid in ("games", "rows", "results", "model_name", "accuracy_note",
                       "accuracy", "generated_at", "updated_at", "source",
                       "model", "name", "note", "accuracy_text", "tested_accuracy"):
                if not isinstance(rec, dict) or "home_win_prob" not in rec:
                    continue
            if not isinstance(rec, dict):
                continue
            rec = dict(rec)
            rec["game_id"] = rec.get("game_id") or gid
            games[str(rec["game_id"])] = rec
    elif isinstance(blob, list):
        for rec in blob:
            if not isinstance(rec, dict) or not rec.get("game_id"):
                continue
            games[str(rec["game_id"])] = dict(rec)
    model_name = (
        raw.get("model_name")
        or raw.get("model")
        or raw.get("name")
        or raw.get("source_label")
        or "team-stats win model"
    )
    accuracy_note = (
        raw.get("accuracy_note")
        or raw.get("accuracy_text")
        or raw.get("tested_accuracy")
        or raw.get("note")
        or ""
    )
    if isinstance(accuracy_note, dict):
        accuracy_note = accuracy_note.get("text") or accuracy_note.get("note") or ""
    accuracy = raw.get("accuracy") if isinstance(raw.get("accuracy"), dict) else None
    return {
        "model_name": str(model_name),
        "accuracy_note": str(accuracy_note).strip(),
        "accuracy": accuracy,
        "generated_at": raw.get("generated_at") or raw.get("updated_at"),
        "games": games,
    }


def winner_from_probs(
    *,
    game: dict,
    home_p: float,
    away_p: float,
    source: str,
    source_label: str,
    updated_at: Optional[str],
    n_books: Optional[int] = None,
    tooltip: Optional[str] = None,
) -> Optional[dict]:
    total = home_p + away_p
    if total <= 0 or not math.isfinite(total):
        return None
    home_p, away_p = home_p / total, away_p / total
    away, home = teams_from_game(game)
    if not away or not home:
        return None
    if home_p > away_p:
        winner, prob = home, home_p
    elif away_p > home_p:
        winner, prob = away, away_p
    else:
        return None  # toss-up: do not invent a side
    if int(round(prob * 100)) == 50:
        return None
    updated = format_et(updated_at)
    if not tooltip:
        if source == "model":
            tooltip = (
                f"From {source_label}."
                + (f" Updated {updated}." if updated else "")
            )
        else:
            tooltip = market_tooltip(updated_at)
    out = {
        "game_id": game.get("game_id"),
        "matchup": game.get("matchup") or f"{away} @ {home}",
        "home_team": home,
        "away_team": away,
        "home_win_prob": round(home_p, 6),
        "away_win_prob": round(away_p, 6),
        "likely_winner": winner,
        "likely_winner_prob": round(prob, 6),
        "winner_source": source,
        "winner_source_label": source_label,
        "winner_tooltip": tooltip,
        "winner_updated_at": updated_at,
    }
    if n_books is not None:
        out["winner_n_books"] = n_books
    return out


def load_market_probs(root: Path, season: int, week: int, games: list[dict]) -> tuple[dict[str, dict], Optional[str]]:
    import pandas as pd

    path = root / "data" / "raw" / "game_lines_latest.parquet"
    if not path.exists():
        log(f"build_winners: no sportsbook file at {path}")
        return {}, None
    df = pd.read_parquet(path)
    if "season" in df.columns:
        df = df[df["season"] == season]
    if "week" in df.columns:
        df = df[df["week"] == week]
    by_id = {}
    pulled = None
    for gid, sub in df.groupby(df["game_id"].astype(str)):
        homes, aways, times = [], [], []
        for rec in sub.to_dict("records"):
            pair = no_vig_pair(rec.get("home_moneyline"), rec.get("away_moneyline"))
            if not pair:
                continue
            homes.append(pair[0])
            aways.append(pair[1])
            if rec.get("pulled_at"):
                times.append(str(rec["pulled_at"]))
        if not homes:
            continue
        by_id[str(gid)] = {
            "home_win_prob": sum(homes) / len(homes),
            "away_win_prob": sum(aways) / len(aways),
            "n_books": len(homes),
            "source": "market",
            "updated_at": max(times) if times else None,
            "home_team": str(sub.iloc[0].get("home_team") or ""),
            "away_team": str(sub.iloc[0].get("away_team") or ""),
            "matchup": str(sub.iloc[0].get("game") or ""),
        }
        if times and (pulled is None or max(times) > pulled):
            pulled = max(times)
    return by_id, pulled


def load_kalshi_probs(root: Path, games: list[dict]) -> tuple[dict[str, dict], Optional[str]]:
    import pandas as pd

    path = root / "data" / "lines" / "kalshi_games_latest.parquet"
    if not path.exists():
        return {}, None
    df = pd.read_parquet(path)
    if "series" in df.columns:
        df = df[df["series"].astype(str) == "KXNFLGAME"]
    if df.empty:
        return {}, None

    index: dict[tuple[str, str], list] = {}
    pulled = None
    for rec in df.to_dict("records"):
        away, home = rec.get("away"), rec.get("home")
        if not away or not home:
            continue
        index.setdefault((str(away), str(home)), []).append(rec)
        if rec.get("pulled_at"):
            ts = str(rec["pulled_at"])
            if pulled is None or ts > pulled:
                pulled = ts

    out = {}
    for g in games:
        away, home = teams_from_game(g)
        if not away or not home:
            continue
        rows = index.get((away, home)) or []
        if not rows:
            continue
        team_mid: dict[str, list[float]] = {away: [], home: []}
        times = []
        for rec in rows:
            bid, ask = rec.get("yes_bid"), rec.get("yes_ask")
            try:
                bid_f = float(bid) if bid is not None else math.nan
                ask_f = float(ask) if ask is not None else math.nan
            except (TypeError, ValueError):
                continue
            if not math.isfinite(bid_f) and not math.isfinite(ask_f):
                continue
            if math.isfinite(bid_f) and math.isfinite(ask_f):
                mid = (bid_f + ask_f) / 2.0
            else:
                mid = bid_f if math.isfinite(bid_f) else ask_f
            # Kalshi yes prices are in dollars (0-1); ignore empty quotes
            if mid > 1.5:
                mid = mid / 100.0
            if not (0 < mid < 1):
                continue
            team = None
            # Prefer the away/home columns + which market this row is
            name = " ".join(
                str(x) for x in (rec.get("source_market_name"), rec.get("yes_sub_title")) if x
            ).lower()
            if home.lower() in name or str(rec.get("yes_sub_title") or "").endswith(home):
                team = home
            if away.lower() in name or str(rec.get("yes_sub_title") or "").endswith(away):
                # more specific: match against team codes via ticker suffix
                team = team  # may already be set
            # source_market_id often ends with -DET / -NE
            mid_id = str(rec.get("source_market_id") or rec.get("event_ticker") or "")
            for code in (home, away):
                if mid_id.endswith("-" + code) or mid_id.endswith(code):
                    team = code
            # If still unknown, a row with yes_sub_title equal to a city isn't mapped
            # reliably; require a code match.
            if team not in team_mid:
                # last resort: two rows, assign later if we can unique them
                continue
            team_mid[team].append(mid)
            if rec.get("pulled_at"):
                times.append(str(rec["pulled_at"]))
        if not team_mid[home] or not team_mid[away]:
            continue
        hp = sum(team_mid[home]) / len(team_mid[home])
        ap = sum(team_mid[away]) / len(team_mid[away])
        total = hp + ap
        if total <= 0:
            continue
        gid = str(g.get("game_id"))
        out[gid] = {
            "home_win_prob": hp / total,
            "away_win_prob": ap / total,
            "n_books": 0,
            "source": "kalshi",
            "updated_at": max(times) if times else pulled,
            "home_team": home,
            "away_team": away,
            "matchup": g.get("matchup") or f"{away} @ {home}",
        }
    return out, pulled


def market_tooltip(updated_at: Optional[str]) -> str:
    updated = format_et(updated_at)
    text = (
        "From sportsbook moneylines with the bookmaker's cut removed. "
        "This is the market's pick, not our model."
    )
    if updated:
        text += f" Updated {updated}."
    return text


def compute_market_accuracy(root: Path) -> Optional[dict]:
    import pandas as pd
    import numpy as np

    path = root / "data" / "raw" / "schedules.parquet"
    if not path.exists():
        log(f"build_winners: no schedules file at {path}; accuracy skipped")
        return None
    sch = pd.read_parquet(path)
    need = ["season", "home_moneyline", "away_moneyline", "home_score", "away_score"]
    if any(c not in sch.columns for c in need):
        log("build_winners: schedules.parquet missing required columns")
        return None

    d = sch.dropna(subset=need).copy()
    d = d[d["home_score"] != d["away_score"]].copy()

    def vec_amer(ml):
        ml = np.asarray(ml, dtype=float)
        out = np.full_like(ml, np.nan, dtype=float)
        neg = ml < 0
        pos = ml > 0
        out[neg] = (-ml[neg]) / ((-ml[neg]) + 100.0)
        out[pos] = 100.0 / (ml[pos] + 100.0)
        return out

    hp = vec_amer(d["home_moneyline"].to_numpy())
    ap = vec_amer(d["away_moneyline"].to_numpy())
    total = hp + ap
    ok = np.isfinite(total) & (total > 0)
    d = d[ok].copy()
    hp, ap = hp[ok], ap[ok]
    hnv, anv = hp / total[ok], ap / total[ok]
    fav_is_home = hnv >= anv
    fav_prob = np.where(fav_is_home, hnv, anv)
    home_won = d["home_score"].to_numpy() > d["away_score"].to_numpy()
    fav_won = np.where(fav_is_home, home_won, ~home_won)
    d = d.assign(fav_prob=fav_prob, fav_won=fav_won)

    def slice_rate(mask, label):
        sub = d[mask]
        n = int(len(sub))
        wins = int(sub["fav_won"].sum()) if n else 0
        rate = (wins / n) if n else None
        return {"label": label, "correct": wins, "n": n, "rate": rate}

    # Headline rates include pick'ems (assigned to the home side when no-vig is tied)
    # so completed-game counts stay complete. Calibration drops exact 50/50 games.
    y2025 = slice_rate(d["season"] == 2025, "2025")
    y2026 = slice_rate(d["season"] == 2026, "2026 so far")
    hist = slice_rate(d["season"].between(2021, 2025), "2021–2025")

    cal = d[(d["season"] >= 2021) & (d["fav_prob"] > 0.5 + 1e-12)].copy()
    if cal.empty:
        cal_lo, cal_hi, cal_so_far = 2021, 2025, False
    else:
        cal_lo = int(cal["season"].min())
        cal_hi = int(cal["season"].max())
        # "so far" when the latest season still has unplayed games, or is current.
        played = set(d.loc[d["season"] == cal_hi].index)
        raw_latest = sch[sch["season"] == cal_hi]
        cal_so_far = len(raw_latest) > len(sch[sch["season"] == cal_hi].dropna(subset=["home_score", "away_score"]))
        if not cal_so_far:
            # still say so far if this is an in-progress season with some scores missing
            cal_so_far = raw_latest["home_score"].isna().any()

    buckets = []
    edges = [(0.50, 0.60, "50–60%"), (0.60, 0.70, "60–70%"), (0.70, 0.80, "70–80%"), (0.80, 1.0001, "80%+")]
    for lo, hi, name in edges:
        if name == "80%+":
            g = cal[cal["fav_prob"] >= lo]
        else:
            g = cal[(cal["fav_prob"] >= lo) & (cal["fav_prob"] < hi)]
        n = int(len(g))
        buckets.append(
            {
                "range": name,
                "predicted": None if n == 0 else float(g["fav_prob"].mean()),
                "actual": None if n == 0 else float(g["fav_won"].mean()),
                "n": n,
            }
        )

    intro_parts = []
    if hist["n"]:
        intro_parts.append(
            f"The betting favorite won {pct1(hist['rate'])} of {hist['n']:,} games in 2021–2025"
        )
    if y2026["n"]:
        extra = f" ({pct1(y2025['rate'])} in 2025)" if y2025["n"] else ""
        intro_parts.append(
            f"and {pct1(y2026['rate'])} of {y2026['n']:,} games so far in 2026{extra}"
        )
    intro = ""
    if intro_parts:
        intro = intro_parts[0]
        if len(intro_parts) > 1:
            intro += ", " + intro_parts[1]
        intro += "."

    cal_n = int(len(cal))
    cal_label = "Calibration, " + en_years(cal_lo, cal_hi, so_far=cal_so_far) + f" ({cal_n:,} games)"
    note = (
        "These figures use closing-line moneylines from nflverse schedules, "
        "with the bookmaker's cut removed. Ties are excluded. "
        "The pick a few days before kickoff can differ slightly from the close."
    )
    return {
        "source": "market",
        "source_label": "betting-market odds",
        "title": "Betting odds favorite accuracy",
        "intro": intro,
        "note": note,
        "headline": [x for x in (hist, y2026, y2025) if x["n"]],
        "calibration": {"label": cal_label, "buckets": buckets},
    }


def accuracy_from_model(model: dict) -> dict:
    acc = {
        "source": "model",
        "source_label": model["model_name"],
        "title": "Betting odds favorite accuracy",
        "intro": model.get("accuracy_note") or "",
        "note": "",
        "headline": [],
        "calibration": None,
    }
    structured = model.get("accuracy") or {}
    if structured.get("intro") and not acc["intro"]:
        acc["intro"] = structured["intro"]
    if structured.get("note"):
        acc["note"] = structured["note"]
    if structured.get("headline"):
        acc["headline"] = structured["headline"]
    if structured.get("calibration"):
        acc["calibration"] = structured["calibration"]
    elif structured.get("buckets"):
        acc["calibration"] = {
            "label": structured.get("label") or "Calibration",
            "buckets": structured["buckets"],
        }
    # If the modeler only supplied a prose note, that is enough.
    return acc


def _unlink(path: Path) -> None:
    if path.exists():
        path.unlink()
        log(f"build_winners: removed {path}")


def strip_winner_fields_from_obj(obj: dict, is_top: bool = False) -> dict:
    if is_top and isinstance(obj.get("games"), list):
        cleaned = []
        for g in obj["games"]:
            g = dict(g)
            for k in WINNER_FIELDS:
                g.pop(k, None)
            cleaned.append(g)
        obj["games"] = cleaned
        obj.pop("winners_file", None)
    for k in WINNER_FIELDS:
        obj.pop(k, None)
    return obj


def clear_published_winners(site: Path, season: Optional[int] = None, week: Optional[int] = None) -> None:
    """Remove published market/model winner artifacts from the site tree."""
    _unlink(site / "data" / "winner_accuracy.json")
    weeks_dir = site / "data" / "weeks"
    if weeks_dir.exists():
        for path in weeks_dir.glob("*/winners.json"):
            _unlink(path)
    # Strip fields from current (and any) week slim files we can find
    stems = []
    if season is not None and week is not None:
        stems.append(f"{int(season)}-wk{int(week):02d}")
    if weeks_dir.exists():
        stems.extend(p.name for p in weeks_dir.iterdir() if p.is_dir())
    seen = set()
    for stem in stems:
        if stem in seen:
            continue
        seen.add(stem)
        week_dir = weeks_dir / stem
        for path in [week_dir / "top.json", site / "data" / "props_top.json"]:
            if not path.exists():
                continue
            try:
                obj = load_json(path)
            except Exception:
                continue
            if not isinstance(obj, dict):
                continue
            # only strip props_top when it matches this stem or always for props_top
            dump_json(path, strip_winner_fields_from_obj(obj, is_top=True))
        games_dir = week_dir / "games"
        if games_dir.exists():
            for path in sorted(games_dir.glob("*.json")):
                try:
                    obj = load_json(path)
                except Exception:
                    continue
                if isinstance(obj, dict):
                    dump_json(path, strip_winner_fields_from_obj(obj))
    man_path = weeks_dir / "index.json"
    if man_path.exists():
        try:
            man = load_json(man_path)
            for entry in man.get("weeks") or []:
                entry.pop("winners_file", None)
            man_path.write_text(json.dumps(man, indent=2) + "\n")
        except Exception:
            pass


def attach_model_to_week_files(site: Path, season: int, week: int, winners: dict[str, dict], payload: dict) -> None:
    """Write model-only fields onto slim game/top files. Does not publish market data."""
    stem = f"{season}-wk{week:02d}"
    week_dir = site / "data" / "weeks" / stem
    model_keys = (
        "model",
        "model_winner",
        "model_winner_prob",
        "model_source_label",
        "model_tooltip",
        "model_updated_at",
        "model_home_win_prob",
        "model_away_win_prob",
    )

    def merge_game_dict(g: dict) -> dict:
        g = dict(g)
        for k in WINNER_FIELDS:
            g.pop(k, None)
        rec = winners.get(str(g.get("game_id") or ""))
        if rec:
            for k in model_keys:
                if rec.get(k) is not None:
                    g[k] = rec[k]
        return g

    def patch_obj(path: Path, is_top: bool = False, is_game: bool = False, gid: Optional[str] = None) -> None:
        if not path.exists():
            return
        try:
            obj = load_json(path)
        except Exception:
            return
        if not isinstance(obj, dict):
            return
        if is_top and isinstance(obj.get("games"), list):
            obj["games"] = [merge_game_dict(dict(g)) for g in obj["games"]]
            obj.pop("winners_file", None)
        if is_game:
            rec = winners.get(str(gid or obj.get("game_id") or path.stem))
            for k in WINNER_FIELDS:
                obj.pop(k, None)
            if rec:
                for k in model_keys:
                    if rec.get(k) is not None:
                        obj[k] = rec[k]
        dump_json(path, obj)

    # Do not publish winners.json (market or otherwise). Model fields live on game/top files.
    _unlink(week_dir / "winners.json")
    acc = payload.get("model_accuracy") or payload.get("accuracy")
    acc_path = site / "data" / "winner_accuracy.json"
    if acc and acc.get("source") == "model":
        dump_json(acc_path, acc, pretty=True)
    else:
        _unlink(acc_path)

    patch_obj(week_dir / "top.json", is_top=True)
    top_root = site / "data" / "props_top.json"
    if top_root.exists():
        try:
            t = load_json(top_root)
            if isinstance(t, dict) and int(t.get("season") or 0) == season and int(t.get("week") or 0) == week:
                patch_obj(top_root, is_top=True)
        except Exception:
            pass
    games_dir = week_dir / "games"
    if games_dir.exists():
        for path in sorted(games_dir.glob("*.json")):
            patch_obj(path, is_game=True, gid=path.stem)

    man_path = site / "data" / "weeks" / "index.json"
    if man_path.exists():
        try:
            man = load_json(man_path)
            for entry in man.get("weeks") or []:
                entry.pop("winners_file", None)
            man_path.write_text(json.dumps(man, indent=2) + "\n")
        except Exception:
            pass


def build(site: Path, season: Optional[int] = None, week: Optional[int] = None) -> int:
    root = project_root(site)

    if season is None or week is None:
        for path in (site / "data" / "props_ev.json", site / "data" / "weeks" / "index.json"):
            if not path.exists():
                continue
            raw = load_json(path)
            if path.name == "index.json":
                season = raw.get("current_season")
                week = raw.get("current_week")
            else:
                season = raw.get("season")
                week = raw.get("week")
            if season is not None and week is not None:
                break
    if season is None or week is None:
        # Still try to clear leftover published files.
        clear_published_winners(site)
        log("build_winners skip: no season/week")
        return 0
    season, week = int(season), int(week)

    model_path = root / "out" / "game_win_probs.json"
    model = parse_model_file(model_path) if model_path.exists() else None
    if not model:
        clear_published_winners(site, season, week)
        log("build_winners: no out/game_win_probs.json; no winner lines published")
        return 0

    games = week_games(site, season, week)
    if not games:
        clear_published_winners(site, season, week)
        log("build_winners skip: no games listed for this week")
        return 0

    winners: dict[str, dict] = {}
    model_accuracy = accuracy_from_model(model)
    model_updated = model.get("generated_at")
    acc_note = (model.get("accuracy_note") or "").strip()
    for g in games:
        gid = str(g.get("game_id") or "")
        rec = model["games"].get(gid)
        if not rec:
            continue
        hp = rec.get("home_win_prob")
        try:
            hp = float(hp)
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(hp) and 0 <= hp <= 1):
            continue
        ap = rec.get("away_win_prob")
        try:
            ap = float(ap) if ap is not None else 1.0 - hp
        except (TypeError, ValueError):
            ap = 1.0 - hp
        merged_game = dict(g)
        if rec.get("home_team") and rec.get("away_team"):
            merged_game["home_team"] = rec["home_team"]
            merged_game["away_team"] = rec["away_team"]
        ts = rec.get("generated_at") or rec.get("updated_at") or model_updated
        updated = format_et(ts)
        tooltip_bits = [f"From {model['model_name']}."]
        if acc_note:
            note = acc_note if acc_note.endswith(".") else acc_note + "."
            tooltip_bits.append(note)
        if updated:
            tooltip_bits.append(f"Updated {updated}.")
        mw = winner_from_probs(
            game=merged_game,
            home_p=hp,
            away_p=ap,
            source="model",
            source_label=model["model_name"],
            updated_at=ts,
            tooltip=" ".join(tooltip_bits),
        )
        if not mw:
            continue
        winners[gid] = {
            "game_id": mw["game_id"],
            "matchup": mw["matchup"],
            "home_team": mw["home_team"],
            "away_team": mw["away_team"],
            "model": {
                "likely_winner": mw["likely_winner"],
                "likely_winner_prob": mw["likely_winner_prob"],
                "home_win_prob": mw["home_win_prob"],
                "away_win_prob": mw["away_win_prob"],
                "source": "model",
                "source_label": model["model_name"],
                "tooltip": mw["winner_tooltip"],
                "updated_at": ts,
                "accuracy_note": acc_note or None,
            },
            "model_winner": mw["likely_winner"],
            "model_winner_prob": mw["likely_winner_prob"],
            "model_source_label": model["model_name"],
            "model_tooltip": mw["winner_tooltip"],
            "model_updated_at": ts,
            "model_home_win_prob": mw["home_win_prob"],
            "model_away_win_prob": mw["away_win_prob"],
        }

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "season": season,
        "week": week,
        "source": "model",
        "source_label": model["model_name"],
        "updated_at": model_updated,
        "games": [winners[str(g["game_id"])] for g in games if str(g.get("game_id")) in winners],
        "missing": [
            {"game_id": g.get("game_id"), "matchup": g.get("matchup")}
            for g in games
            if str(g.get("game_id")) not in winners
        ],
        "model_accuracy": model_accuracy,
        "accuracy": model_accuracy,
    }
    attach_model_to_week_files(site, season, week, winners, payload)
    log(
        f"build_winners: source=model {len(payload['games'])} games with an Our model line, "
        f"{len(payload['missing'])} without, week {season}-wk{week:02d}"
    )
    return 0


def main(argv: list[str]) -> int:
    site = Path(argv[1]).resolve() if len(argv) > 1 else Path(__file__).resolve().parent
    season = int(argv[2]) if len(argv) > 2 else None
    week = int(argv[3]) if len(argv) > 3 else None
    try:
        return build(site, season, week)
    except Exception as exc:
        # Never fail a publish because winner data could not be built.
        log(f"build_winners skip: {type(exc).__name__}: {exc}")
        return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
