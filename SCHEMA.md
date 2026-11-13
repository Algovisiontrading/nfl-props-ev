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
| `market` | string | yes | Preferred slugs: `pass_yds`, `pass_tds`, `completions`, `interceptions`, `rush_yds`, `carries`, `rush_tds`, `rec_yds`, `receptions`, `rec_tds`, `anytime_td`. Human-readable labels are also displayed if sent. |
| `side` | string | yes | `over` / `under`. |
| `line` | number | yes | Posted line. |
| `odds_american` | number | yes | American odds (e.g. `-110`, `+145`). |
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

These five context fields are optional and lightweight. The site never requires them for v1; rows without them render normally.


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
| `overall`, `by_market`, `by_season` | Accept `n` or `sample_size`; `roi` / `roi_pct`; `clv` / `clv_pct`; `passed` / `model_passed`. |
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
| `models[].calibration` | Optional; ignored by the v1 comparison grid (top-level `calibration` is used for the reliability chart). |

A stats-only model is defined as one with **no betting-market inputs** such as spread, implied total, or moneyline.

Hypothetical ROI and CLV are model backtest figures only — not live betting results. No bets are placed by this project.
