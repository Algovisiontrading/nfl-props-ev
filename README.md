# NFL Player Props EV

Static dashboard of **model-estimated** expected value for NFL player props. Published to GitHub Pages.

**These are model estimates, not guarantees. This project does not place bets.** Sample data (when the banner is shown) is placeholder only and must not be treated as real edges or recommendations.

- Dashboard: `index.html`
- Track record / calibration / model comparison: `track-record.html`
- JSON contract: [`SCHEMA.md`](SCHEMA.md)
- Publish: `./publish.sh` (copies `out/props_ev.json` and `models/track_record.json` when present, then pushes this repo)

Stake suggestions are quarter-Kelly, capped at 2% of bankroll, and are not betting advice.
