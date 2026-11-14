/* Shared helpers for the NFL Props EV static dashboard. No dependencies. */
(function (global) {
  "use strict";

  // Canonical market keys, plus aliases (Props Data vs older SCHEMA names).
  // Keep in sync with SCHEMA.md.
  var MARKET_ALIASES = {
    completions: "pass_completions",
    pass_completion: "pass_completions",
    interceptions: "pass_ints",
    interception: "pass_ints",
    ints: "pass_ints",
    int: "pass_ints",
    carries: "rush_attempts",
    carry: "rush_attempts",
  };

  var MARKET_LABELS = {
    pass_yds: "Pass yards",
    pass_tds: "Pass TDs",
    pass_completions: "Pass completions",
    pass_attempts: "Pass attempts",
    pass_ints: "Interceptions thrown",
    rush_yds: "Rush yards",
    rush_attempts: "Rush attempts",
    rush_tds: "Rush TDs",
    rec_yds: "Receiving yards",
    receptions: "Receptions",
    rec_tds: "Receiving TDs",
    anytime_td: "Anytime TD",
    player_tds: "Player TDs",
    rush_rec_yds: "Rush + rec yards",
  };

  function canonicalMarket(m) {
    if (m == null || m === "") return "";
    var key = String(m).trim().toLowerCase().replace(/[\s-]+/g, "_");
    return MARKET_ALIASES[key] || key;
  }

  function pick(obj, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] != null && obj[k] !== "") return obj[k];
    }
    return undefined;
  }

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function americanToImplied(odds) {
    var o = Number(odds);
    if (!Number.isFinite(o) || o === 0) return null;
    return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
  }

  function americanToDecimal(odds) {
    var o = Number(odds);
    if (!Number.isFinite(o) || o === 0) return null;
    return o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
  }

  function probToAmerican(p) {
    if (!(p > 0 && p < 1)) return null;
    if (p >= 0.5) return Math.round((-100 * p) / (1 - p));
    return Math.round((100 * (1 - p)) / p);
  }

  function evPer100(p, odds) {
    var dec = americanToDecimal(odds);
    if (dec == null || !Number.isFinite(p)) return null;
    return (p * dec - 1) * 100;
  }

  function quarterKellyCap2(p, odds) {
    var dec = americanToDecimal(odds);
    if (dec == null || !(dec > 1) || !Number.isFinite(p)) return null;
    var b = dec - 1;
    var f = (p * dec - 1) / b;
    if (!(f > 0)) return 0;
    return Math.min((f / 4) * 100, 2);
  }

  function formatAmerican(odds) {
    var n = num(odds);
    if (n == null) return "—";
    var r = Math.round(n);
    return r > 0 ? "+" + r : String(r);
  }

  function formatPct(v, digits) {
    if (!Number.isFinite(v)) return "—";
    var d = digits == null ? 1 : digits;
    return (v >= 0 ? "" : "") + v.toFixed(d) + "%";
  }

  function formatSignedPct(v, digits) {
    if (!Number.isFinite(v)) return "—";
    var d = digits == null ? 1 : digits;
    var s = v > 0 ? "+" : "";
    return s + v.toFixed(d) + "%";
  }

  function formatProb(p) {
    if (!Number.isFinite(p)) return "—";
    return (p * 100).toFixed(1) + "%";
  }

  function formatMoney(v) {
    if (!Number.isFinite(v)) return "—";
    var s = v > 0 ? "+" : "";
    return s + "$" + v.toFixed(2);
  }

  function formatProjNumber(v, market) {
    if (!Number.isFinite(v)) return null;
    var m = canonicalMarket(market || "");
    if (m === "pass_yds" || m === "rush_yds" || m === "rec_yds" || /_yds$/.test(m)) {
      return String(Math.round(v));
    }
    if (m === "anytime_td" || m === "player_tds") {
      return v.toFixed(2);
    }
    return v.toFixed(1);
  }

  function formatProjection(row) {
    if (!row) return "—";
    var mid = row.proj_median;
    var lo = row.proj_p25;
    var hi = row.proj_p75;
    if (!Number.isFinite(mid)) mid = row.model_mean;
    if (!Number.isFinite(mid)) return "—";
    var s = formatProjNumber(mid, row.market);
    if (s == null) return "—";
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      var a = formatProjNumber(lo, row.market);
      var b = formatProjNumber(hi, row.market);
      if (a != null && b != null) s += " (" + a + "–" + b + ")";
    }
    return s;
  }

  function formatInt(v) {
    if (!Number.isFinite(v)) return "—";
    return Math.round(v).toLocaleString("en-US");
  }

  function formatET(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return fmt.format(d) + " ET";
  }

  function formatKickoff(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " ET";
  }

  function marketLabel(m) {
    var key = canonicalMarket(m);
    if (!key) return "—";
    if (MARKET_LABELS[key]) return MARKET_LABELS[key];
    return String(key)
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function isSample(payload) {
    return !!(payload && payload.sample === true);
  }

  function isFailed(row) {
    var v = row && row.model_passed;
    return v === false || v === "false" || v === 0 || v === "0";
  }


  // Fallback tier/summary rules. Keep in sync with SCHEMA.md and the How-to box.
  var TIER_THRESHOLDS = {
    strongMinEv: 5,     // Strong when ev_per_100 >= 5
    strongMinEdge: 4,   // and edge_pct >= 4
    // and confidence is not "low"
    leanMinEv: 0,       // Lean when ev_per_100 > 0
    leanMinEdge: 2,     // and edge_pct >= 2
    // Pass otherwise
  };

  function normalizeTierName(v) {
    if (v == null || v === "") return null;
    var s = String(v).trim();
    var low = s.toLowerCase();
    if (low === "strong") return "Strong";
    if (low === "lean") return "Lean";
    if (low === "pass") return "Pass";
    return s;
  }

  function fallbackTier(row) {
    var ev = row.ev_per_100;
    var edge = row.edge_pct;
    var conf = String(row.confidence || "").toLowerCase();
    if (Number.isFinite(ev) && Number.isFinite(edge) && ev >= TIER_THRESHOLDS.strongMinEv && edge >= TIER_THRESHOLDS.strongMinEdge && conf !== "low") {
      return "Strong";
    }
    if (Number.isFinite(ev) && Number.isFinite(edge) && ev > TIER_THRESHOLDS.leanMinEv && edge >= TIER_THRESHOLDS.leanMinEdge) {
      return "Lean";
    }
    return "Pass";
  }

  function fallbackSummary(row) {
    var ev = Number.isFinite(row.ev_per_100) ? formatMoney(row.ev_per_100) + " EV / $100" : "EV unavailable";
    var edge = Number.isFinite(row.edge_pct) ? formatSignedPct(row.edge_pct) + " edge" : "edge unavailable";
    if (row.tier === "Strong") {
      return "Strong: " + ev + " and " + edge + ", confidence is not low.";
    }
    if (row.tier === "Lean") {
      return "Lean: positive EV (" + ev + ", " + edge + ").";
    }
    return "Pass: does not meet the Lean threshold (EV / $100 > 0 and edge ≥ 2%).";
  }

  // Site-side safety guards. Applied even when the JSON already supplies a tier.
  // Keep in sync with SCHEMA.md and the How-to box.
  var SAFETY_GUARDS = {
    checkEdgePct: 15,            // edge_pct > 15 → "Check", never Strong
    kalshiThinSpreadCents: 5,    // Kalshi ask−bid > 5 cents → "Thin market"
  };

  function isKalshiBook(book) {
    return String(book || "").toLowerCase().indexOf("kalshi") !== -1;
  }

  function hasListedLiquidity(row) {
    var vol = row.volume;
    var oi = row.kalshi_open_interest;
    var hasVol = Number.isFinite(vol) && vol > 0;
    var hasOi = Number.isFinite(oi) && oi > 0;
    return hasVol || hasOi;
  }

  function kalshiSpreadCents(row, raw) {
    raw = raw || {};
    var spr = row.kalshi_spread_cents;
    if (spr == null) spr = num(pick(raw, ["kalshi_spread_cents", "spread_cents"]));
    if (spr != null) return spr;
    var ask = row.kalshi_ask != null ? row.kalshi_ask : num(pick(raw, ["kalshi_ask", "ask"]));
    var bid = row.kalshi_bid != null ? row.kalshi_bid : num(pick(raw, ["kalshi_bid", "bid"]));
    if (ask == null || bid == null) return null;
    var diff = ask - bid;
    // Values in [0, 1] are treated as dollars per $1 contract; otherwise as cents.
    if (Math.abs(ask) <= 1 && Math.abs(bid) <= 1) return diff * 100;
    return diff;
  }

  function parseSuppliedFlags(raw) {
    var out = { check: false, thin: false };
    function eat(v) {
      if (v == null || v === "") return;
      if (Array.isArray(v)) { v.forEach(eat); return; }
      if (v === true || v === 1) { out.check = true; return; }
      var s = String(v).trim().toLowerCase().replace(/[_-]+/g, " ");
      if (!s || s === "false" || s === "0" || s === "none" || s === "pass") return;
      if (s === "true" || s === "check" || s === "flag") out.check = true;
      else if (s.indexOf("thin") !== -1) out.thin = true;
      else if (s === "check badge" || s.indexOf("check") !== -1) out.check = true;
    }
    raw = raw || {};
    eat(raw.flag);
    eat(raw.flags);
    eat(raw.check);
    return out;
  }

  function applySafetyGuards(row, raw) {
    raw = raw || {};
    row.badges = [];
    // (1) Failed calibration: never assign a tier. Hidden by default on the board.
    if (isFailed(row)) {
      row.tier = null;
      return row;
    }
    var supplied = parseSuppliedFlags(raw);
    var check = Number.isFinite(row.edge_pct) && row.edge_pct > SAFETY_GUARDS.checkEdgePct;
    var thin = false;
    if (isKalshiBook(row.book)) {
      var spread = kalshiSpreadCents(row, raw);
      if (spread != null) row.kalshi_spread_cents = spread;
      if (!hasListedLiquidity(row) || (spread != null && spread > SAFETY_GUARDS.kalshiThinSpreadCents)) {
        thin = true;
      }
    }
    if (supplied.check) check = true;
    if (supplied.thin) thin = true;

    if (thin) {
      row.badges.push("Thin market");
      if (row.tier === "Strong" || row.tier === "Lean") row.tier = "Pass";
    }
    if (check) {
      row.badges.push("Check");
      if (row.tier === "Strong") row.tier = "Lean";
      if (thin) row.tier = "Pass";
    }
    return row;
  }

  function applyTierAndSummary(row, raw) {
    raw = raw || {};
    var suppliedTier = normalizeTierName(pick(raw, ["tier"]));
    var suppliedSummary = pick(raw, ["summary"]);
    row.tier_source = suppliedTier ? "modeler" : "fallback";
    row.summary_source = suppliedSummary ? "modeler" : "fallback";
    row.tier = suppliedTier || fallbackTier(row);
    applySafetyGuards(row, raw);
    row.summary = suppliedSummary || fallbackSummary(row);
    return row;
  }

  function normalizePayload(raw) {
    if (Array.isArray(raw)) {
      return { generated_at: null, updated_at: null, season: null, week: null, sample: false, rows: raw };
    }
    var rows = raw && (raw.rows || raw.data || raw.props) ? (raw.rows || raw.data || raw.props) : [];
    if (!Array.isArray(rows)) rows = [];
    return {
      generated_at: raw.generated_at || raw.updated_at || null,
      updated_at: raw.updated_at || raw.generated_at || null,
      season: raw.season != null ? raw.season : null,
      week: raw.week != null ? raw.week : null,
      sample: raw.sample === true,
      rows: rows,
    };
  }

  function normalizeRow(raw, meta) {
    meta = meta || {};
    var row = {};
    row.player = pick(raw, ["player", "player_name"]) || "";
    row.player_id = pick(raw, ["player_id"]);
    row.position = pick(raw, ["position", "pos"]) || "";
    row.team = pick(raw, ["team"]) || "";
    row.opponent = pick(raw, ["opponent", "opp"]) || "";
    row.game_id = pick(raw, ["game_id"]);
    row.matchup =
      pick(raw, ["matchup", "game"]) ||
      (row.team && row.opponent ? row.team + " vs " + row.opponent : "") ||
      "";
    row.game = row.matchup;
    row.kickoff = pick(raw, ["kickoff", "kickoff_at", "start_time"]);
    row.market = canonicalMarket(pick(raw, ["market"]) || "");
    var side = pick(raw, ["side"]);
    row.side = side != null ? String(side).toLowerCase() : "";
    row.line = num(pick(raw, ["line"]));
    row.odds_american = num(pick(raw, ["odds_american", "odds", "price"]));
    row.book = pick(raw, ["book"]) || "";
    row.model_prob = num(pick(raw, ["model_prob", "prob", "p_model"]));
    row.implied_prob_novig = num(pick(raw, ["implied_prob_novig", "implied_novig", "implied_prob"]));
    row.fair_odds_american = num(pick(raw, ["fair_odds_american", "fair_odds"]));
    row.edge_pct = num(pick(raw, ["edge_pct", "edge"]));
    row.ev_per_100 = num(pick(raw, ["ev_per_100", "ev"]));
    row.kelly_stake_pct = num(pick(raw, ["kelly_stake_pct", "kelly", "stake_pct"]));
    row.drivers = pick(raw, ["drivers", "reason", "why"]) || "";
    row.reason = row.drivers;
    row.confidence = pick(raw, ["confidence"]);
    row.sample_size = num(pick(raw, ["sample_size", "n", "n_games"]));
    row.model_passed = raw.model_passed;
    if (row.model_passed == null) row.model_passed = raw.passed;
    row.updated_at = pick(raw, ["updated_at", "generated_at"]) || meta.generated_at || meta.updated_at;
    row.volume = num(pick(raw, ["volume", "kalshi_volume"]));
    row.kalshi_open_interest = num(pick(raw, ["kalshi_open_interest", "open_interest", "oi"]));
    row.kalshi_bid = num(pick(raw, ["kalshi_bid", "bid"]));
    row.kalshi_ask = num(pick(raw, ["kalshi_ask", "ask"]));
    row.kalshi_spread_cents = num(pick(raw, ["kalshi_spread_cents", "spread_cents"]));
    row.flag = pick(raw, ["flag", "flags"]);
    row.check = pick(raw, ["check"]);
    row.roof = pick(raw, ["roof"]);
    row.wind_mph = num(pick(raw, ["wind_mph", "wind"]));
    row.temp_f = num(pick(raw, ["temp_f", "temp"]));
    row.precip_pct = num(pick(raw, ["precip_pct", "precip"]));
    row.coaching_flag = pick(raw, ["coaching_flag"]);
    row.model_mean = num(pick(raw, ["model_mean", "mean", "proj_mean"]));
    row.proj_median = num(pick(raw, ["proj_median", "median", "model_median"]));
    row.proj_p25 = num(pick(raw, ["proj_p25", "p25", "model_p25", "q25"]));
    row.proj_p75 = num(pick(raw, ["proj_p75", "p75", "model_p75", "q75"]));

    var impliedRaw = americanToImplied(row.odds_american);
    var implied = row.implied_prob_novig != null ? row.implied_prob_novig : impliedRaw;
    if (row.fair_odds_american == null && row.model_prob != null) {
      row.fair_odds_american = probToAmerican(row.model_prob);
    }
    if (row.edge_pct == null && row.model_prob != null && implied != null) {
      row.edge_pct = (row.model_prob - implied) * 100;
    }
    if (row.ev_per_100 == null && row.model_prob != null && row.odds_american != null) {
      row.ev_per_100 = evPer100(row.model_prob, row.odds_american);
    }
    if (row.kelly_stake_pct == null && row.model_prob != null && row.odds_american != null) {
      row.kelly_stake_pct = quarterKellyCap2(row.model_prob, row.odds_american);
    }
    applyTierAndSummary(row, raw);
    return row;
  }

  function lastUpdated(payload, rows) {
    if (payload && (payload.generated_at || payload.updated_at)) {
      return payload.generated_at || payload.updated_at;
    }
    var best = null;
    (rows || []).forEach(function (r) {
      if (r.updated_at && (!best || String(r.updated_at) > String(best))) best = r.updated_at;
    });
    return best;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function contextChips(row) {
    var chips = [];
    if (row.roof) {
      var roofLabel = String(row.roof);
      if (roofLabel === "outdoors") roofLabel = "Outdoors";
      else if (roofLabel === "dome") roofLabel = "Dome";
      else if (roofLabel === "retractable") roofLabel = "Retractable";
      chips.push(roofLabel);
    }
    if (row.temp_f != null) chips.push(Math.round(row.temp_f) + "°F");
    if (row.wind_mph != null) chips.push("Wind " + Math.round(row.wind_mph) + " mph");
    if (row.precip_pct != null) chips.push("Precip " + Math.round(row.precip_pct) + "%");
    if (row.coaching_flag) chips.push(String(row.coaching_flag));
    if (!chips.length) return "";
    return (
      '<span class="chips">' +
      chips
        .map(function (c) {
          return '<span class="chip">' + escapeHtml(c) + "</span>";
        })
        .join("") +
      "</span>"
    );
  }

  function liquidityLine(row) {
    var parts = [];
    if (row.volume != null) parts.push("Vol " + formatInt(row.volume));
    if (row.kalshi_open_interest != null) parts.push("OI " + formatInt(row.kalshi_open_interest));
    return parts.join(" · ");
  }

  function evClass(v) {
    if (!Number.isFinite(v)) return "muted";
    if (v > 0) return "pos-ev";
    if (v < 0) return "neg-ev";
    return "muted";
  }

  function edgeClass(v) {
    if (!Number.isFinite(v)) return "muted";
    if (v > 0) return "pos-edge";
    if (v < 0) return "neg-edge";
    return "muted";
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (res.status === 404) {
        var err = new Error("not_found");
        err.status = 404;
        throw err;
      }
      if (!res.ok) {
        var err2 = new Error("http_" + res.status);
        err2.status = res.status;
        throw err2;
      }
      return res.json();
    });
  }


  var SITE_BACKTEST_BANNER = "Backtested on 2026 weeks 1–9 at Kalshi prices: break-even. Picks are a paper test, not proven profit.";
  var SITE_BACKTEST_HREF = "track-record.html#kalshi-backtest";

  function ensureSiteBacktestBanner() {
    if (typeof document === "undefined") return;
    if (document.getElementById("site-backtest-banner")) return;
    var main = document.querySelector("main.wrap") || document.querySelector("main");
    if (!main) return;
    var a = document.createElement("a");
    a.className = "site-backtest-banner";
    a.id = "site-backtest-banner";
    var path = (typeof location !== "undefined" && location.pathname) ? location.pathname : "";
    a.href = /track-record\.html$/i.test(path) ? "#kalshi-backtest" : SITE_BACKTEST_HREF;
    a.textContent = SITE_BACKTEST_BANNER;
    main.insertBefore(a, main.firstChild);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureSiteBacktestBanner);
    else ensureSiteBacktestBanner();
  }

  global.PropsEV = {
    MARKET_LABELS: MARKET_LABELS,
    MARKET_ALIASES: MARKET_ALIASES,
    canonicalMarket: canonicalMarket,
    TIER_THRESHOLDS: TIER_THRESHOLDS,
    SAFETY_GUARDS: SAFETY_GUARDS,
    applySafetyGuards: applySafetyGuards,
    normalizeTierName: normalizeTierName,
    fallbackTier: fallbackTier,
    fallbackSummary: fallbackSummary,
    applyTierAndSummary: applyTierAndSummary,
    pick: pick,
    num: num,
    americanToImplied: americanToImplied,
    americanToDecimal: americanToDecimal,
    probToAmerican: probToAmerican,
    evPer100: evPer100,
    quarterKellyCap2: quarterKellyCap2,
    formatAmerican: formatAmerican,
    formatPct: formatPct,
    formatSignedPct: formatSignedPct,
    formatProb: formatProb,
    formatMoney: formatMoney,
    formatProjNumber: formatProjNumber,
    formatProjection: formatProjection,
    formatInt: formatInt,
    formatET: formatET,
    formatKickoff: formatKickoff,
    marketLabel: marketLabel,
    isSample: isSample,
    isFailed: isFailed,
    normalizePayload: normalizePayload,
    normalizeRow: normalizeRow,
    lastUpdated: lastUpdated,
    escapeHtml: escapeHtml,
    contextChips: contextChips,
    liquidityLine: liquidityLine,
    evClass: evClass,
    edgeClass: edgeClass,
    fetchJson: fetchJson,
    SITE_BACKTEST_BANNER: SITE_BACKTEST_BANNER,
    SITE_BACKTEST_HREF: SITE_BACKTEST_HREF,
    ensureSiteBacktestBanner: ensureSiteBacktestBanner,
  };
})(window);
