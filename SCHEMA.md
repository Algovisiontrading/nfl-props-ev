# NFL Props EV — site JSON contract

This file is the contract between Props Data / Props Modeler and the static dashboard in `site/`. It is aligned with `/workspace/nfl-props/models/SCHEMA_props_ev.md` (when present) and extends it with aliases, optional fields, and the track-record file the Track Record page reads.

The site JavaScript is tolerant: it accepts either a `{ "rows": [...] }` document or a bare array, missing optional fields, and will compute `fair_odds_american`, `edge_pct`, `ev_per_100`, and `kelly_stake_pct` from `model_prob` + `odds_american` when those derived fields are absent.

## `data/props_ev.json`

Copied at publish time from `out/props_ev.json` when that file exists. Until then the repo ships a clearly labeled sample file.

```json
{
  "generated_at": "2026-11-13T09:00:00-05:00",
  "updated_at": "2026-11-13T09:00:00-05:00",
  "season": 2026,
  "week": 10,
  "sample": false,
  "rows": [ { "...row fields..." } ]
}
```

### Top-level fields

| Field | Required | Notes |
|---|---|---|
| `generated_at` | preferred | ISO-8601 timestamp. Shown as last updated in America/New_York, labeled **ET**. |
| `updated_at` | optional | Alias for `generated_at` if `generated_at` is missing. Per-row `updated_at` is also accepted as a fallback (max of rows). |
| `season` | preferred | Integer season year (e.g. `2026`). |
| `week` | preferred | Integer NFL week (e.g. `10`). |
| `sample` | optional | If `true`, the dashboard shows a banner: **Sample data, model outputs not published yet**. Sample numbers must never be presented as real. When a real `out/props_ev.json` is published, omit `sample` or set it to `false` so the banner disappears. |
| `rows` | preferred | Array of prop rows. A bare array at the top level is also accepted. |

Rows should be sorted by `ev_per_100` descending (best bets first). The site re-sorts anyway and exposes sortable columns.

### Row fields

Primary names below are the ones the site writes in its sample file and prefers when reading. **Aliases** in parentheses are accepted.

| Field | Type | Required | Notes |
|---|---|---|---|
| `player` | string | yes | Display name. |
| `player_id` | string | optional | nflverse `gsis_id` or any stable id. |
| `position` | string | preferred | `QB` / `RB` / `WR` / `TE` (other values still render). |
| `team` | string | preferred | Player's team abbreviation. |
| `opponent` | string | preferred | Opponent abbreviation. |
| `game_id` | string | optional | e.g. `2026_11_IND_HOU`. |
| `matchup` (`game`) | string | preferred | `"AWAY @ HOME"`, e.g. `"BUF @ KC"`. `matchup` is the primary name on the site; `game` is the name in the modeler schema and is treated as an alias (and vice versa). |
| `kickoff` | string | preferred | ISO-8601 with offset, America/New_York. |
| `market` | string | yes | Canonical slugs (aliases in parentheses are accepted and normalized by the site): `pass_yds`, `pass_tds`, `pass_completions` (`completions`), `pass_attempts`, `pass_ints` (`interceptions`, `ints`), `rush_yds`, `rush_attempts` (`carries`), `rush_tds`, `rec_yds`, `receptions`, `rec_tds`, `anytime_td`, plus lines-only keys `player_tds` and `rush_rec_yds`. The market filter shows each canonical market once. Labels: Pass yards, Pass TDs, Pass completions, Pass attempts, Interceptions thrown, Rush yards, Rush attempts, Rush TDs, Receiving yards, Receptions, Receiving TDs, Anytime TD, Player TDs, Rush + rec yards. |
| `side` | string | yes | `over` / `under`. |
| `line` | number | yes | Posted line. |
| `odds_american` (`odds`) | number | yes | American odds (e.g. `-110`, `+145`). `odds` is accepted as an alias. |
| `book` | string | preferred | Sportsbook or source (e.g. `kalshi`). |
| `model_prob` | number | yes | Model probability of the side, 0–1. |
| `fair_odds_american` | int | optional | Fair American odds from `model_prob`. Computed if missing. |
| `implied_prob_novig` | number | optional | No-vig implied probability 0–1 (null if one-sided). If missing, edge is computed from the raw implied probability of `odds_american`. |
| `edge_pct` | number | optional | `(model_prob - implied_prob_novig) * 100`. Computed if missing. |
| `ev_per_100` | number | optional | Expected profit per $100 staked at `odds_american`. Computed if missing: `(model_prob * decimal_odds - 1) * 100`. |
| `kelly_stake_pct` | number | optional | Quarter-Kelly fraction of bankroll, **capped at 2.0**, `0` if EV ≤ 0. Computed if missing. |
| `drivers` (`reason`) | string | optional | Short "why" / key drivers. `drivers` is the primary site name; `reason` is the modeler-schema alias. |
| `confidence` | string | optional | `low` / `medium` / `high` (other values still render). |
| `sample_size` | number | optional | Player prior games / sample used. |
| `model_passed` | boolean | optional | If `false`, the row is **hidden by default**. A toggle on the dashboard reveals these rows. Missing is treated as passed (row is shown). |
| `updated_at` | string | optional | Per-row ISO-8601 timestamp. |
| `volume` | number | optional | Traded volume when the source provides it (Kalshi or otherwise). Shown next to the book when present. |
| `kalshi_open_interest` | number | optional | Kalshi open interest. Shown alongside `volume` when present. |
| `roof` | string | optional | Venue roof: `dome`, `retractable`, or `outdoors`. Rendered as a small chip when present; ignored if absent. |
| `wind_mph` | number | optional | Wind speed in mph. Chip when present. |
| `temp_f` | number | optional | Temperature in °F. Chip when present. |
| `precip_pct` | number | optional | Precipitation chance, 0–100. Chip when present. |
| `coaching_flag` | string | optional | Short coaching-context tag, e.g. `new OC`. Chip when present. |
| `tier` | string | optional | `Strong`, `Lean`, or `Pass`. Used as-is when the modeler supplies it. |
| `summary` | string | optional | One plain-English line. Used as-is when the modeler supplies it. |
| `flag` / `check` | string, boolean, or array | optional | If supplied, honored like the site-side guards: `check`/`true` → Check badge (never Strong); a value containing `thin` → Thin market badge (never Strong or Lean). |

If `tier` or `summary` is omitted, the site computes a fallback (thresholds are also listed in the How-to box and in `TIER_THRESHOLDS` in `js/common.js`):

- **Strong** when `ev_per_100 >= 5`, `edge_pct >= 4`, and `confidence` is not `low`
- **Lean** when `ev_per_100 > 0` and `edge_pct >= 2`
- **Pass** otherwise

Site-side safety guards are applied **even when the JSON supplies a `tier`**. They can only hold a row back; they never upgrade a tier.

- If `model_passed === false`, the row **never gets a tier** (the `tier` field is ignored) and stays **hidden by default** (a toggle reveals these rows).
- If `edge_pct > 15`, the row gets a **Check** badge and is **never shown as Strong** (Strong is downgraded to Lean, unless a Thin-market guard also applies).
- If `book` contains `"kalshi"` (case-insensitive) and the row has **no volume and no open interest** (`volume` / `kalshi_volume` and `kalshi_open_interest` / `open_interest` / `oi` are missing or 0), or the ask-minus-bid spread is **over 5 cents** (`kalshi_spread_cents`, or `kalshi_ask` − `kalshi_bid`; dollar-denominated bid/ask are multiplied by 100), the row gets a **Thin market** badge and **never gets Strong or Lean** (tier becomes Pass).
- If the JSON supplies a `flag` or `check` field, it is honored the same way: values of `check` / `true` apply the Check guard; values containing `thin` (e.g. `"Thin market"`, `thin_market`) apply the Thin-market guard. Arrays of flags are accepted.



These five context fields are optional and lightweight. The site never requires them for v1; rows without them render normally.


### Market key aliases

The site canonicalizes market slugs in `js/common.js` (`canonicalMarket`) so the dashboard filter lists each market once, whichever form arrives:

| Alias (accepted) | Canonical key | Label |
|---|---|---|
| `completions` | `pass_completions` | Pass completions |
| `interceptions`, `ints` | `pass_ints` | Interceptions thrown |
| `carries` | `rush_attempts` | Rush attempts |

Other labels: `pass_yds` Pass yards; `pass_tds` Pass TDs; `pass_attempts` Pass attempts; `rush_yds` Rush yards; `rush_tds` Rush TDs; `rec_yds` Receiving yards; `receptions` Receptions; `rec_tds` Receiving TDs; `anytime_td` Anytime TD; `player_tds` Player TDs; `rush_rec_yds` Rush + rec yards.

### Derived-field formulas (used when a field is omitted)

- Implied probability from American odds `o`: `o > 0 → 100 / (o + 100)`, else `|o| / (|o| + 100)`.
- Decimal odds: `o > 0 → o/100 + 1`, else `100/|o| + 1`.
- Fair American odds from probability `p`: `p ≥ 0.5 → round(-100 * p / (1-p))`, else `round(100 * (1-p) / p)`.
- `edge_pct = (model_prob - implied) * 100`, using `implied_prob_novig` when present, otherwise raw implied from `odds_american`.
- `ev_per_100 = (model_prob * decimal_odds - 1) * 100`.
- Full Kelly `f* = (model_prob * decimal_odds - 1) / (decimal_odds - 1)`; `kelly_stake_pct = min(2, max(0, (f* / 4) * 100))`.

## `data/track_record.json`

Copied at publish time from `models/track_record.json` when that file exists. If the file is missing, the Track Record page shows a friendly “backtest not published yet” state (it does not error). If `"sample": true`, a sample banner is shown and figures are not presented as live results.

```json
{
  "generated_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "sample": false,
  "train_seasons": [2018, 2019, 2020, 2021, 2022, 2023],
  "validation_seasons": [2024],
  "test_seasons": [2025, 2026],
  "overall": {
    "log_loss": 0.68,
    "brier": 0.24,
    "n": 1000,
    "roi_pct": 1.4,
    "clv_pct": 0.6
  },
  "by_market": [
    {"market": "rec_yds", "log_loss": 0.67, "brier": 0.23, "n": 200, "roi_pct": 2.0, "clv_pct": 0.8, "passed": true}
  ],
  "by_season": [
    {"season": 2025, "split": "test", "log_loss": 0.68, "brier": 0.24, "n": 400, "roi_pct": 1.5, "clv_pct": 0.7}
  ],
  "calibration": [
    {"bin_lo": 0.50, "bin_hi": 0.55, "predicted": 0.525, "actual": 0.51, "n": 120, "market": "all"}
  ]
}
```

### Track-record field notes

| Field | Notes |
|---|---|
| `overall`, `by_market`, `by_season` | Accept `n` or `sample_size`; `roi` / `roi_pct`; `clv` / `clv_pct`; `passed` / `model_passed`; optional `crps` (yardage markets). |
| `calibration` | Bins for the reliability diagram. Accept `predicted` / `pred` / `mean_predicted`; `actual` / `observed` / `mean_actual` / `hit_rate`; `bin_lo`/`bin_hi` or `lo`/`hi` or a `bin` label; `n` / `sample_size`. |
| `sample` | Same meaning as in `props_ev.json`. |

### Model comparison (`models`)

Optional. When present, the Track Record page renders a **2×2-style comparison per market**: Baseline / ML × Stats-only / With market inputs.

Canonical `models[].name` values (use these; the site still **tolerates arbitrary names**):

- `baseline_stats_only`
- `baseline_market`
- `ml_stats_only`
- `ml_market`

```json
"models": [
  {
    "name": "baseline_stats_only",
    "uses_market_inputs": false,
    "overall": {"log_loss": 0.69, "brier": 0.25, "n": 700, "roi_pct": 0.4, "clv_pct": 0.1},
    "by_market": [
      {"market": "rec_yds", "log_loss": 0.68, "brier": 0.24, "n": 100, "roi_pct": 0.8, "clv_pct": 0.3, "passed": true}
    ]
  }
]
```

| Field | Notes |
|---|---|
| `models` | Array of model objects (a `{ "name": { ... } }` map is also accepted). |
| `models[].name` | Any string. Canonical names above are grouped into the 2×2. Unknown names still render, in an “Other models” row/section. |
| `models[].uses_market_inputs` | Optional boolean. The label **“Stats-only = no betting-market inputs”** (and the per-model “no betting-market inputs” tag) is shown when `uses_market_inputs === false`. If the flag is **missing**, the site falls back to a name ending in `_stats_only`. |
| `models[].overall` | Same metric fields as top-level `overall`. |
| `models[].by_market` | Same row shape as top-level `by_market`. Side-by-side cells use these per-market metrics. |
| `crps` | Optional continuous ranked probability score, typically on yardage markets (`pass_yds`, `rush_yds`, `rec_yds`). Shown in the model comparison panel when present (overall or per-market). Lower is better. |
| `models[].calibration` | Optional; ignored by the v1 comparison grid (top-level `calibration` is used for the reliability chart). |

A stats-only model is defined as one with **no betting-market inputs** such as spread, implied total, or moneyline.

Hypothetical ROI and CLV are model backtest figures only — not live betting results. No bets are placed by this project.


## `data/graded_picks.json`

Copied at publish time from `models/graded_picks.json` when that file exists. If the file is missing, is empty, or has `"sample": true`, the Track Record page shows **First graded week: Week 10, results Tuesday Nov 17.** and does not present sample rows as real results. If `"sample": true`, a sample banner is shown and the figures are not presented as real graded results.

```json
{
  "generated_at": "ISO-8601",
  "sample": false,
  "picks": [
    {
      "season": 2026,
      "week": 10,
      "game": "WAS @ NYG",
      "kickoff": "2026-11-12T20:15:00-05:00",
      "player": "Player Name",
      "position": "WR",
      "market": "rec_yds",
      "side": "over",
      "line": 62.5,
      "odds_american": -110,
      "book": "DraftKings",
      "model_prob": 0.58,
      "edge_pct": 6.4,
      "model_name": "ml_market",
      "snapshot_at": "2026-11-12T12:05:00-05:00",
      "actual": 71.0,
      "result": "hit",
      "source": "live"
    }
  ]
}
```

| Field | Notes |
|---|---|
| `generated_at` | ISO-8601 timestamp for the file. |
| `sample` | If `true`, show a sample banner. Never present sample picks as real. |
| `picks` | Array of graded picks (a top-level array is also accepted). |
| `season`, `week` | Integers. |
| `game` | Matchup string, e.g. `"WAS @ NYG"`. Alias: `matchup`. |
| `kickoff` | ISO-8601 kickoff. |
| `player`, `position`, `market`, `side`, `line`, `odds_american` (alias `odds`), `book` | Same meaning as in `props_ev.json`. |
| `model_prob` | Pregame side probability only (0–1), frozen at `snapshot_at`. |
| `edge_pct` | Optional pregame edge. |
| `model_name` | Optional, e.g. `ml_market`. |
| `snapshot_at` | ISO-8601. **Must be before `kickoff`.** If `snapshot_at` is on or after kickoff, the site flags the row as invalid and **drops it from bucket stats**. If `snapshot_at` is missing, the row is shown as **unverified** (not marked invalid) and is still eligible for bucket stats. |
| `actual` | Realized stat value (number; may be null for voids). |
| `result` | `"hit"` \| `"miss"` \| `"push"` \| `"void"`. Hits **and** misses are listed. |
| `source` | `"backtest"` \| `"live"` \| `"user_slip"`. |

Probability-bucket summary uses side `model_prob` in bins **50–55, 55–60, 60–65, 65–70, 70–80, and 80+**. Columns: bucket, picks, hits, hit rate, average model prob, gap (hit rate minus average prob). **Pushes, voids, and invalid snapshots are excluded from the rates.**

Optional fields used by the **Paper bets** running tally on the Track Record page (record, profit per $100, beat-the-closing-line rate, broken out by week, tier, market, and pick type). All of these are optional; the page renders only the breakouts the file actually contains and never invents numbers.

| Field | Notes |
|---|---|
| `tier` | `"Strong"` \| `"Lean"` \| `"Pass"` (aliases: `ev_tier`, `signal`, `recommendation`). |
| `pick_type` | `"prop"` / `"props"`, `"winner_favorite"`, or `"winner_model"` (aliases: `type`, `bet_type`). Labels on the page: **Props**, **Winner: betting favorite**, **Winner: our stats model**. Player-prop rows default to `"prop"` when this field is omitted. |
| `profit_per_100` | Profit on a flat $100 paper bet (aliases: `profit`, `pnl_per_100`, `pnl`). If omitted, the page computes it from `result` + `odds_american` when both are present. |
| `beat_close` | Boolean, whether the pick beat the closing line (aliases: `beat_closing_line`, `clv_flag`, `beat_cl`, `clv_positive`). A numeric `clv` / `clv_pct` greater than 0 is also accepted. The rate is shown only when at least one row (or a summary block) has this field. |
| `summary`, `by_week`, `by_tier`, `by_market`, `by_pick_type` | Optional pre-aggregated blocks. Each row may include `bets`, `wins`, `losses`, `pushes`, `record`, `profit_per_100` (or `roi_per_100`), and `beat_close_rate`. If these blocks are present they are used as written; otherwise the page aggregates from `picks`. |

## `data/moneyline_backtest.json`

Copied at publish time from `models/moneyline_roi_backtest_results.json` when that file exists. If it is missing, the **Moneyline replay (2023–25)** section is hidden (the page does not error). Numbers are rendered from the file, not hardcoded.

Expected shape (field names from Props Modeler's results file):

```json
{
  "stake": 100,
  "settle": "nflverse closing-ish moneyline, vig included",
  "ties_excluded": true,
  "blocks": {
    "test_2023_2025": {
      "games": 854,
      "edge_0pt": {"bets": 854, "wins": 324, "losses": 530, "profit": -7784.0, "roi_per_100": -9.11, "dogs": 622, "by_season": {"2023": -0.5, "2024": -17.78, "2025": -9.06}},
      "edge_3pt": {"bets": 721, "wins": 265, "losses": 456, "roi_per_100": -8.68},
      "edge_5pt": {"bets": 616, "wins": 214, "losses": 402, "roi_per_100": -10.15},
      "bet_every_favorite": {"bets": 854, "wins": 582, "losses": 272, "roi_per_100": -0.35}
    },
    "2026_through_wk9": {
      "games": 135,
      "edge_0pt": {"bets": 135, "wins": 57, "losses": 78, "roi_per_100": 4.31, "roi_ci95": [-19.21, 28.04]}
    }
  }
}
```

The 2023–25 block is the main table (Rule, Bets, Record, Profit per $100 bet). Other blocks, such as 2026-to-date, are shown below it with a small-sample caveat that uses `games` and `roi_ci95` from the file when present.

## `data/kalshi_backtest_2026.json`

Copied at publish time from `models/kalshi_backtest_2026_results.json`. The Track Record section **Kalshi backtest, 2026 weeks 1–9** renders **only** `variants.oos` (models refit on data through 2025). The `live_as_published` / in-sample figures are never shown. Headline rows come from `headline_one_bet_per_player_market` (`all`, `by_tier`, `by_market`) with `bets`, `wins` / `losses` / `record`, `roi_per_100`, and `roi_ci95_game_cluster`. Naive baselines come from `naive_market_baseline`. The optional `projection_vs_market.by_market` table shows our miss vs the market implied-median miss and head-to-head `% closer`. If the file is missing or has no out-of-sample block, the section stays in its empty state. Numbers are rendered from the file only.

## Week archive (`data/weeks/`)

`publish.sh` automatically archives the current `data/props_ev.json` to `data/weeks/<season>-wk<NN>.json` whenever it publishes (for example `2026-wk10.json`). Prior weeks are kept. The manifest `data/weeks/index.json` lists available weeks and names the current (latest) week:

```json
{
  "generated_at": "ISO-8601",
  "current_season": 2026,
  "current_week": 10,
  "weeks": [
    {"season": 2026, "week": 10, "file": "2026-wk10.json", "generated_at": "ISO-8601", "rows": 3141, "games": 13, "sample": false}
  ]
}
```

The dashboard and game pages read this manifest, default to `current_season` / `current_week`, and let you browse past weeks. If the manifest is missing, they fall back to `data/props_ev.json`.

To keep phones from downloading the full week file on first load, `publish.sh` also writes compact files (same `generated_at`, slim row fields only):

- `data/weeks/<season>-wk<NN>/top.json` — Strong and Lean rows after site-side safety guards, plus a `games[]` summary (matchup, kickoff, game_id, strong/lean/pass/check/thin counts) so the Games cards work without the full file. Also copied to `data/props_top.json` for the current week only.
- `data/weeks/<season>-wk<NN>/all.json` — every passing row, still slimmer than the week file.
- `data/weeks/<season>-wk<NN>/games/<game_id>.json` — that game's passing rows only.

The dashboard loads `top.json` (or `data/props_top.json` when the selected week is the manifest's current week). Pass rows are fetched from `all.json` only when the visitor turns on **Show Pass** or uses a filter that needs them. Game pages load only their per-game file. If a slim file is missing, the page falls back to the full week JSON, then to `data/props_ev.json`. Do not use `data/props_top.json` for a week that is not the current week.

The list renders 100 rows at a time, with Previous / Show more, so the DOM does not hold thousands of rows.

## Betting odds favorite (and optional model line)

At publish time `archive_week.py` runs `build_winners.py`, which writes:

- `data/weeks/<season>-wk<NN>/winners.json` — one entry per game that has a market (or model) probability, plus the accuracy block
- `data/winner_accuracy.json` — market-favorite accuracy for the Track Record page (title: **Betting odds favorite accuracy**). If a model file was present, its note is stored under `model_accuracy` and shown separately, never in place of the market figures.
- the `likely_winner` / `likely_winner_prob` fields (market favorite) and, when present, `model_winner` / `model_winner_prob`, on each Games-card object in `top.json` / `props_top.json` and on each `games/<game_id>.json`

The dashboard and game page always label the market line **Betting odds favorite: DET (57%)**. Tooltip: *From sportsbook moneylines with the bookmaker's cut removed. This is the market's pick, not our model. Updated &lt;time ET&gt;.*

Source rules, and the builder never invents a number:

1. Sportsbook moneylines from `data/raw/game_lines_latest.parquet` are converted to implied probabilities, the vig is removed so the two sides sum to 1, and no-vig probabilities are averaged across books. If a game has no sportsbook moneyline, fall back to Kalshi `KXNFLGAME` winner markets in `data/lines/kalshi_games_latest.parquet` (mid of `yes_bid` / `yes_ask`, then normalize). Market accuracy is recomputed each run from closing moneylines in `data/raw/schedules.parquet` (ties excluded). The calibration heading uses the same season range as the games in those buckets. These are closing-line odds, so a pick a few days before kickoff can differ slightly.
2. If `/workspace/nfl-props/out/game_win_probs.json` also exists, it is shown as a **separate** line, **Our model: TEAM (X%)**, and never replaces the betting-odds favorite. Expected shape: a top-level `model_name` and `accuracy_note` (or `accuracy_text` / `tested_accuracy`), plus per-`game_id` `home_win_prob` (optional `away_win_prob`). `games` may be an object keyed by `game_id` or a list of rows. Games not in that file simply have no model line. The model tooltip includes the tested-accuracy note when one is supplied.

If the parquet files or pandas/pyarrow are missing, publish still succeeds and the UI omits the favorite line and the accuracy section.


Manifest week entries may also include `top_file`, `all_file`, `games_dir`, and `top_rows`.

Game pages use `game.html?week=N&game=<game_id>` (optional `season`). Picks are a flat list sorted Strong, then Lean, then Pass, and by `ev_per_100` descending within each tier. Rows with a Check or Thin market badge always sort to the bottom.

## `data/projections.json`

Built at publish time by `build_projections.py` from the first available source in `out/`: `projections.json`, `projections_full.json`, `projections_week.json`, other `projections*.json`, then `projections_week.csv` / `projections.csv`. A copy is also written to `data/weeks/<season>-wk<NN>/projections.json`. The Projections page prefers the week file when a week is selected. Rows are slimmed to identity fields plus `model_mean`, `proj_median`, `proj_p25`, `proj_p75`, and optional flags such as `market_passed`. The page shows median with a 25th–75th percentile range when those fields exist, otherwise the mean. A payload `note` is shown when present.

## `data/projection_accuracy.json`

Copied at publish time from `models/projection_accuracy.json`. This is the source for the **Projection accuracy** tables on Track Record and the Projections page (the older CSV test-set file may still be copied but is not shown). Expected fields: `seasons`, `season_type`, `refit_cadence`, `lowcount_note`, and `by_market[]` with `market`, `n`, `mae_model`, `mae_model_mean`, `mae_season_avg`, `mae_last8`, `coverage_p25_p75`, `plain_english`, and optional `by_season`. Display columns: Stat, Games, Our miss, Season avg miss, Last-8 miss, Inside our range, plus the plain-English line and per-season breakdown from the file. Numbers are rendered from the file only.

## `data/parlays.json`

Copied at publish time from `out/parlays.json` only (never from `out/candidates/`). A week copy is written to `data/weeks/<season>-wk<NN>/parlays.json` when season/week are in the file. If `out/parlays.json` is missing, no parlays file is published and the Parlays sections stay hidden. Schema is keyed by `game_id` (for example `games` / `by_game`), with optional `cross_game` parlays. Each parlay may include `type` (safest / best payout / cross-game), `legs` (player, market, side, line, odds), `joint_hit_prob` / `joint_hit_chance`, `payout_american` / `payout`, and `ev_per_100`.

## `data/paper_bets/`

Copied at publish time from `out/paper_bets/summary_*.json`. `index.json` lists those files (`kind` = week or season). The Track Record **Paper bets** tally renders graded weeks (bets / wins / losses / `roi_per_100` / `beat_close_rate`, by tier, market, and pick type). Until Tuesday's grading, files may list logged-but-unsettled picks in `pushes_voids` with `bets: 0`; the page then keeps the empty state and does not treat those zeros as results.
