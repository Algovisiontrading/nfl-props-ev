# NFL Player Props EV

Static dashboard of **model-estimated** expected value for NFL player props. Published to GitHub Pages.

**These are model estimates, not guarantees. This project does not place bets.** Sample data (when the banner is shown) is placeholder only and must not be treated as real edges or recommendations.

- Dashboard (best bets + Games): `index.html`
- Game page: `game.html?week=N&game=<game_id>`
- Track record / calibration / model comparison / graded picks: `track-record.html`
- JSON contract: [`SCHEMA.md`](SCHEMA.md)
- Week archive: `data/weeks/<season>-wk<NN>.json` and `data/weeks/index.json` (written automatically by `publish.sh`)
- Publish: `./publish.sh` copies `out/props_ev.json`, `models/track_record.json`, and `out/` (or `models/`) `graded_picks.json` when present, archives the current week, then pushes this repo

The week selector defaults to the current week in the manifest; past weeks stay browsable. Game pages list picks in a flat Strong → Lean → Pass order (then EV); Check and Thin market rows sit at the bottom.

Stake suggestions are quarter-Kelly, capped at 2% of bankroll, and are not betting advice.
