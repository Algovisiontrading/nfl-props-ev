# NFL Player Props EV

Static dashboard of **model-estimated** expected value for NFL player props. Published to GitHub Pages.

**These are model estimates, not guarantees. This project does not place bets.** Sample data (when the banner is shown) is placeholder only and must not be treated as real edges or recommendations.

- Dashboard (best bets + Games): `index.html`
- Game page: `game.html?week=N&game=<game_id>`
- Track record / calibration / model comparison / graded picks: `track-record.html`
- JSON contract: [`SCHEMA.md`](SCHEMA.md)
- Week archive: `data/weeks/<season>-wk<NN>.json` and `data/weeks/index.json` (written automatically by `publish.sh`)
- Slim first-load files: `data/props_top.json` (current week's Strong/Lean plus game counts), `data/weeks/<season>-wk<NN>/top.json`, `all.json`, and `games/<game_id>.json`. The dashboard loads the top file first; **Show Pass** (or a filter) loads `all.json`. Game pages load only their per-game file. Full `props_ev.json` is still published as a fallback.
- Win-model line: shown only when `out/game_win_probs.json` exists, labeled **Our model: TEAM (X%)**, with that file's tested-accuracy note. If the file is missing, game cards and game pages have no winner line, and Track Record has no favorite-accuracy section.
- Publish: `./publish.sh` copies `out/props_ev.json`, `models/track_record.json`, and `out/` (or `models/`) `graded_picks.json` when present, archives the current week, then pushes this repo

The week selector defaults to the current week in the manifest; past weeks stay browsable. Game pages list picks in a flat Strong → Lean → Pass order (then EV); Check and Thin market rows sit at the bottom.

Stake suggestions are quarter-Kelly, capped at 2% of bankroll, and are not betting advice.
