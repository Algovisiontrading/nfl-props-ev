# NFL Player Props EV

Static dashboard of **model-estimated** expected value for NFL player props. Published to GitHub Pages.

**These are model estimates, not guarantees. This project does not place bets.** Sample data (when the banner is shown) is placeholder only and must not be treated as real edges or recommendations.

- Dashboard (best bets + Games): `index.html`
- Game page: `game.html?week=N&game=<game_id>`
- Track record / calibration / model comparison / moneyline replay / paper bets: `track-record.html`
- JSON contract: [`SCHEMA.md`](SCHEMA.md)
- Week archive: `data/weeks/<season>-wk<NN>.json` and `data/weeks/index.json` (written automatically by `publish.sh`)
- Slim first-load files: `data/props_top.json` (current week's Strong/Lean plus game counts), `data/weeks/<season>-wk<NN>/top.json`, `all.json`, and `games/<game_id>.json`. The dashboard loads the top file first; **Show Pass** (or a filter) loads `all.json`. Game pages load only their per-game file. Full `props_ev.json` is still published as a fallback.
- Moneyline replay: `data/moneyline_backtest.json`, copied from `models/moneyline_roi_backtest_results.json` when present. Shown on the Track Record page as **Moneyline replay (2023–25)**. If the file is missing, that section is hidden.
- Kalshi weeks 1–9 props backtest: `data/kalshi_props_backtest.json`, copied from `out/` or `models/` (`kalshi_props_backtest.json` or `kalshi_props_backtest_results.json`) when present. The Track Record page shows an empty state until that file exists. Numbers are rendered from the file only.
- Paper bets: `data/graded_picks.json`. Until a real (non-sample) graded file is published, the Track Record page shows “First graded week: Week 10, results Tuesday Nov 17.” When the file lands, a running tally (record, profit per $100, beat-the-closing-line rate, by week / tier / market / pick type) is rendered from that file.
- Betting odds favorite: `data/weeks/<season>-wk<NN>/winners.json` and `data/winner_accuracy.json`, written at publish time from no-vig sportsbook moneylines (Kalshi fallback). Labeled **Betting odds favorite**, not as our pick. If `out/game_win_probs.json` is also present, a separate **Our model** line is shown next to it, never instead of it. Games without market data show no favorite line.
- Publish: `./publish.sh` copies `out/props_ev.json`, `models/track_record.json`, `models/moneyline_roi_backtest_results.json` (as `data/moneyline_backtest.json`), optional Kalshi props backtest results (as `data/kalshi_props_backtest.json`), and `out/` (or `models/`) `graded_picks.json` when present, archives the current week, then pushes this repo. Missing optional files are skipped.

The week selector defaults to the current week in the manifest; past weeks stay browsable. Game pages list picks in a flat Strong → Lean → Pass order (then EV); Check and Thin market rows sit at the bottom.

Stake suggestions are quarter-Kelly, capped at 2% of bankroll, and are not betting advice.
